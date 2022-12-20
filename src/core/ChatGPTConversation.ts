import {db} from "../database/db";
import {MultiMessage} from "../shared/MultiMessage";
import {EmbedType, Message, TextBasedChannel, User} from "discord.js";
import {logMessage} from "../utils/logMessage";

// @ts-ignore
import {encode} from 'gpt-3-encoder';
import {Configuration, CreateCompletionResponse, OpenAIApi} from 'openai';
import {AxiosResponse} from "axios";
import {getEnv} from "../utils/GetEnv";
import {getMissingAPIKeyResponse} from "../utils/GetMissingAPIKeyResponse";
import {ModelInfo, ModelName} from "./ModelInfo";
import {getOriginalPrompt} from "./GetOriginalPrompt";
import {END_OF_PROMPT, END_OF_TEXT} from "./constants";
import {getOpenAIKeyForId, OpenAICache} from "./GetOpenAIKeyForId";
import {trySendingMessage} from "./TrySendingMessage";
import {discordClient, getGuildName} from "../discord/discordClient";

const cache: Record<string, ChatGPTConversation | undefined | null> = {};

const THREAD_PREFIX = `THREAD-`;


const OPENAI_API_KEY = getEnv('OPENAI_API_KEY');
const MAIN_SERVER_ID = getEnv('MAIN_SERVER_ID');

if (!OPENAI_API_KEY) {
    throw new Error('Need OPENAI_API_KEY env variable.');
}
if (!MAIN_SERVER_ID) {
    throw new Error('Need MAIN_SERVER_ID env variable.');
}


OpenAICache[MAIN_SERVER_ID] = new OpenAIApi(new Configuration({
    apiKey: OPENAI_API_KEY,
}));


type CompletionError = {
    error?: {
        message: string;
        type: string;
        param: string | null;
        code: string | null;
    }
};

export class ChatGPTConversation {
    lastUpdated: number = 0;

    lastDiscordMessageId: string | null = null;

    deleted: boolean = false;
    allHistory = '';
    numPrompts = 0;
    currentHistory = '';

    public isDirectMessage: boolean = false;

    constructor(
        public threadId: string,
        public creatorId: string,
        public guildId: string,
        private username: string,
        private model: ModelName,
    ) {
        this.currentHistory = getOriginalPrompt(this.username);
        this.allHistory = this.currentHistory;
    }

    async persist() {
        cache[this.threadId] = this;
        this.lastUpdated = new Date().getTime();
        await db.set(ChatGPTConversation.getDBKey(this.threadId), this).catch(e => {
            logMessage('failed to persist thread: ', e);
        });
    }

    private static getDBKey(threadId: string) {
        return `${THREAD_PREFIX}${threadId}`;
    }

    static async retrieve(threadId: string): Promise<ChatGPTConversation | null> {
        const inCache = cache[threadId];
        if (inCache !== undefined) {
            // either null or exists
            // if null, not our thread
            return inCache;
        }

        const fromDb = await db.get<ChatGPTConversation>(ChatGPTConversation.getDBKey(threadId));

        if (fromDb != null) {
            return await this.handleRetrievalFromDB(fromDb);
        } else {
            cache[threadId] = null;
        }

        return null;
    }

    private static async handleRetrievalFromDB(fromDb: ChatGPTConversation) {
        const threadId = fromDb.threadId;

        let updatingPrompts = fromDb.numPrompts === undefined;
        if (updatingPrompts) {
            fromDb.numPrompts = fromDb.allHistory.split(END_OF_PROMPT).slice(3).length;
            logMessage(`<#${fromDb.threadId}>: ${fromDb.numPrompts} prompts.`);
        }

        const result = new ChatGPTConversation(threadId, fromDb.creatorId, fromDb.guildId, fromDb.username, fromDb.model ?? 'text-davinci-003');
        Object.assign(result, fromDb);
        cache[threadId] = result;

        if (updatingPrompts) {
            await result.persist();
        }

        return result;
    }

    private async SendPromptToGPTChat(
        openai: OpenAIApi,
        user: User,
        message: string,
        onProgress: (result: string, finished: boolean) => void,
    ): Promise<string | null> {
        const newPromptText = `
(${user.username}|${user.id}): ${message}${END_OF_PROMPT}
${this.username}:`;

        let newHistory = this.currentHistory + newPromptText;

        let finished = false;
        let result = '';

        while (!finished) {
            let response: AxiosResponse<CreateCompletionResponse> | undefined;
            let newHistoryTokens: number;

            try {
                newHistoryTokens = encode(newHistory).length;
            } catch (e) {
                newHistoryTokens = Math.floor((newHistory ?? '').split(' ').length * 1.20);
            }

            const maxallowedtokens = ModelInfo[this.model].MAX_ALLOWED_TOKENS;
            if (newHistoryTokens > maxallowedtokens) {
                const allPrompts = newHistory.split(END_OF_PROMPT);
                const userPrompts = allPrompts.slice(3);

                let numPromptsToRemove = 0;
                let totalTokens = 0;

                const tokensToRemove = newHistoryTokens - maxallowedtokens;
                logMessage(`<#${this.threadId}> need to remove tokens...`, {
                    total: newHistoryTokens,
                    maxallowedtokens,
                    tokensToRemove,
                })

                while (numPromptsToRemove < userPrompts.length) {
                    try {
                        totalTokens += encode(userPrompts[numPromptsToRemove]).length;
                    } catch (e) {
                        totalTokens += Math.floor((userPrompts[numPromptsToRemove] ?? '').split(' ').length * 1.20);
                    }
                    numPromptsToRemove++;

                    if (totalTokens > tokensToRemove) {
                        break;
                    }
                }

                logMessage(`<#${this.threadId}> removed prompts:`, userPrompts.slice(0, numPromptsToRemove));

                // truncate parts of earlier history...
                newHistory = allPrompts.slice(0, 3)
                    .concat(userPrompts.slice(numPromptsToRemove))
                    .join(END_OF_PROMPT);
            }


            try {
                const maxTokens = ModelInfo[this.model].MAX_TOKENS_PER_MESSAGE;

                response = await openai.createCompletion({
                    model: this.model,
                    prompt: newHistory,
                    temperature: 0.8,
                    max_tokens: maxTokens,
                    top_p: 0.9,
                    frequency_penalty: 0,
                    presence_penalty: 0,
                }) as any;
            } catch (e: any) {
                if (e.isAxiosError) {
                    response = e.response;
                } else {
                    logMessage('Unhandled error:', e);
                }
            }

            if (!response) {
                onProgress('[[Could not get a response from OpenAI :( Perhaps their servers are down?]]', true);
                finished = true;
                break;
            }

            if (response.status !== 200) {
                const data = response.data as unknown as CompletionError;

                if (data.error?.type === 'insufficient_quota') {
                    onProgress('[[Whoops, ran out of tokens :( Contact your OpenAI account holder please.]]', true);
                } else if (data.error?.message) {
                    onProgress(`[[Error from OpenAI servers: "${data.error.message}"]]`, true);
                } else {
                    onProgress('[[Unknown error from OpenAI servers. Please ping the bot owner for help.]]', true);
                }

                logMessage('Bad response', response.data);
                finished = true;
                break;
            } else {
                const choices = response.data.choices;
                if (choices.length !== 1) {
                    logMessage('Not enough choices?!');

                    return null;
                }

                const choice = choices[0];

                const text = choice.text;

                newHistory += text;
                result += text;

                if (text == undefined) {
                    logMessage('No text?!');
                    return null;
                }

                if (choice.finish_reason === 'stop') {
                    finished = true;

                    newHistory += END_OF_TEXT;

                    this.currentHistory = newHistory;

                    logMessage(`<#${this.threadId}> response: ${result}`);

                    this.allHistory += newPromptText + result + END_OF_TEXT;
                    this.numPrompts++;

                    await this.persist();

                    if (onProgress) {
                        onProgress(result, true);
                    }

                    return result;
                } else {
                    if (onProgress) {
                        onProgress(result, false);
                    }

                    finished = false;
                }
            }
        }

        return null;
    }

    async handlePrompt(
        user: User,
        channel: TextBasedChannel,
        inputValue: string,
        messageToReplyTo?: Message<boolean>,
    ): Promise<void> {
        let openai: OpenAIApi | undefined;

        logMessage(`New prompt by [${user.username}] in [${await this.getDebugName(user)}|<#${channel.id}>]: ${inputValue}`);

        if (this.isDirectMessage) {
            openai = await getOpenAIKeyForId(user.id);
        } else {
            openai = await getOpenAIKeyForId(this.guildId);

            if (!openai) {
                // fallback to user's key...
                openai = await getOpenAIKeyForId(user.id);
            }
        }

        if (!openai) {
            logMessage(`No api key for [${(await this.getDebugName(user))}].`);

            const response = await getMissingAPIKeyResponse(this.isDirectMessage);

            const MAIN_SERVER_INVITE = getEnv('MAIN_SERVER_INVITE');
            if (MAIN_SERVER_INVITE) {
                response.content += '\n' + MAIN_SERVER_INVITE;
            }

            await trySendingMessage(channel, response, messageToReplyTo);

            return;
        }

        if (inputValue === '<DEBUG>') {
            const {lastUpdated} = this;
            const debugInfo = {lastUpdated};
            const debugMessage = `Debug: 
\`\`\`json
${JSON.stringify(debugInfo, null, '  ')}
\`\`\``;

            await trySendingMessage(channel, {content: debugMessage}, messageToReplyTo);

            return;
        }

        await channel.sendTyping();

        const multi = new MultiMessage(channel, undefined, messageToReplyTo);

        if (messageToReplyTo) {
            this.lastDiscordMessageId = messageToReplyTo.id
        }

        await this.SendPromptToGPTChat(
            openai,
            user,
            inputValue,
            (result, finished) => {
                multi.update(result, finished);

                if (finished && multi.messageList.length > 0) {
                    this.lastDiscordMessageId = multi.messageList[multi.messageList.length - 1].message.id
                    this.persist();
                }
            }
        );
    }

    private async getDebugName(user: User) {
        return this.isDirectMessage ? user.username : await getGuildName(this.guildId);
    }

    static async initialise(callback: (info: ChatGPTConversation) => Promise<void>) {
        const results = await db.find({
            key: {$regex: /^THREAD-/},
            $and: [
                {
                    $or: [
                        {
                            "value.deleted": false,
                        },
                        {
                            "value.deleted": {$exists: false}
                        }
                    ],
                },
                {
                    $or: [
                        {
                            "value.lastUpdated": {
                                $gt: new Date().getTime() - 86400000,
                            }
                        },
                        {
                            "value.lastUpdated": {$exists: false}
                        }
                    ]
                }
            ],
        }).toArray();

        logMessage(`Found ${results.length} number of threads to check.`)

        await Promise.all(results.map(async result => {
            const fromDb = result.value as ChatGPTConversation;
            const info = await this.handleRetrievalFromDB(fromDb);

            if (info != null) {
                try {
                    await callback(info);
                } catch (e) {
                    logMessage('Failed to initialise info with thread is ', info.threadId, e);
                }
            }
        }));

        logMessage('Initialisation complete.');
    }
}
