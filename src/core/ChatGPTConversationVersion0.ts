import {db} from "../database/db";
import {MultiMessage} from "../shared/MultiMessage";
import {EmbedType, Message, TextBasedChannel, User} from "discord.js";
import {logMessage} from "../utils/logMessage";

// @ts-ignore
import {CreateCompletionResponse, OpenAIApi} from 'openai';
import {AxiosResponse} from "axios";
import {getEnv} from "../utils/GetEnv";
import {getMissingAPIKeyResponse} from "../utils/GetMissingAPIKeyResponse";
import {ModelName} from "./ModelInfo";
import {getOriginalPrompt} from "./GetOriginalPrompt";
import {END_OF_PROMPT, END_OF_TEXT} from "./constants";
import {getOpenAIForId} from "./GetOpenAIForId";
import {trySendingMessage} from "./TrySendingMessage";
import {getGuildName} from "../discord/discordClient";
import {BaseConversation} from "./BaseConversation";
import {CompletionError} from "./CompletionError";
import {encodeLength} from "./EncodeLength";
import {ChatGPTConversation} from "./ChatGPTConversation";
import {getConfigForId, ServerConfigType} from "./config";


export class ChatGPTConversationVersion0 extends BaseConversation {
    lastUpdated: number = 0;

    lastDiscordMessageId: string | null = null;

    allHistory = '';
    numPrompts = 0;
    currentHistory = '';

    public isDirectMessage: boolean = false;

    constructor(
        threadId: string,
        creatorId: string,
        guildId: string,
        public username: string,
        public model: ModelName,
    ) {
        super(threadId, creatorId, guildId);

        this.currentHistory = getOriginalPrompt(this.username);
        this.allHistory = this.currentHistory;
    }

    public static async handleRetrievalFromDB(fromDb: ChatGPTConversationVersion0) {
        const threadId = fromDb.threadId;

        let updatingPrompts = fromDb.numPrompts === undefined;
        if (updatingPrompts) {
            fromDb.numPrompts = fromDb.allHistory.split(END_OF_PROMPT).slice(3).length;
            logMessage(`${await BaseConversation.GetLinkableId(fromDb)}: ${fromDb.numPrompts} prompts.`);
        }

        const result = new ChatGPTConversationVersion0(threadId, fromDb.creatorId, fromDb.guildId, fromDb.username, fromDb.model ?? 'text-davinci-003');
        Object.assign(result, fromDb);

        if (updatingPrompts) {
            await result.persist();
        }

        return result;
    }

    private async SendPromptToGPTChat(
        config: ServerConfigType,
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

            let newHistoryTokens = encodeLength(newHistory);
            const maxAllowedTokens = config.modelInfo[this.model].MAX_ALLOWED_TOKENS;
            if (newHistoryTokens > maxAllowedTokens) {
                const allPrompts = newHistory.split(END_OF_PROMPT);
                const userPrompts = allPrompts.slice(3);

                let numPromptsToRemove = 0;
                let totalTokens = 0;

                const tokensToRemove = newHistoryTokens - maxAllowedTokens;
                logMessage(`${await this.getLinkableId()} need to remove tokens...`, {
                    total: newHistoryTokens,
                    maxallowedtokens: maxAllowedTokens,
                    tokensToRemove,
                })

                while (numPromptsToRemove < userPrompts.length) {
                    totalTokens += encodeLength(userPrompts[numPromptsToRemove]);
                    numPromptsToRemove++;

                    if (totalTokens > tokensToRemove) {
                        break;
                    }
                }

                logMessage(`${await this.getLinkableId()} removed prompts:`, userPrompts.slice(0, numPromptsToRemove));

                // truncate parts of earlier history...
                newHistory = allPrompts.slice(0, 3)
                    .concat(userPrompts.slice(numPromptsToRemove))
                    .join(END_OF_PROMPT);
            }


            try {
                const maxTokens = config.modelInfo[this.model].MAX_TOKENS_PER_RESPONSE;

                // https://www.npmjs.com/package/compute-cosine-similarity

                // embedding.config.

                response = await openai.createCompletion({
                    model: this.model,
                    prompt: newHistory,
                    temperature: 0.8,
                    max_tokens: maxTokens,
                    top_p: 0.9,
                    frequency_penalty: 0,
                    presence_penalty: 0,
                    user: user.id,
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

                    logMessage(`RESPONSE: ${await this.getLinkableId()} ${result}`);

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

        logMessage(`PROMPT: by [${user.username}] in ${await this.getLinkableId()}: ${inputValue}`);

        const serverConfig = await getConfigForId(this.isDirectMessage ? user.id : this.guildId);

        if (this.isDirectMessage) {
            openai = await getOpenAIForId(user.id);
        } else {
            openai = await getOpenAIForId(this.guildId);

            if (!openai) {
                // fallback to user's key...
                openai = await getOpenAIForId(user.id);
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

        try {
            await channel.sendTyping();
        } catch (e) {
            logMessage(`${await this.getLinkableId()} Cannot send typing..`, e);
        }

        const multi = new MultiMessage(channel, undefined, messageToReplyTo);

        if (messageToReplyTo) {
            this.lastDiscordMessageId = messageToReplyTo.id
        }

        await this.SendPromptToGPTChat(
            serverConfig,
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

    static async initialiseAll() {
        const results = await db.find({
            key: {$regex: /^THREAD-/},
            $and: [
                {
                    "value.version": {$exists: false}
                },
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

        logMessage(`Found ${results.length} number of version0 threads to check.`)

        await Promise.all(results.map(async result => {
            const fromDb = result.value as ChatGPTConversationVersion0;

            const upgraded = await ChatGPTConversation.upgrade(fromDb);

            if (upgraded != null) {
                await upgraded.initialise();
                return;
            }

            const info = await this.handleRetrievalFromDB(fromDb);

            if (info != null) {
                try {
                    await info.initialise();
                } catch (e) {
                    logMessage('Failed to initialise info with thread is ', info.threadId, e);
                }
            }
        }));

        logMessage('Initialisation complete.');
    }
}
