import {db} from "../database/db";
import {MultiMessage} from "../shared/MultiMessage";
import {Collection, EmbedType, Message, TextBasedChannel, User} from "discord.js";
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
import {getWhimsicalResponse} from "../discord/listeners/ready/getWhimsicalResponse";
import {messageReceivedInThread} from "../discord/listeners/ready/message-handling/handleThread";
import {BaseConversation} from "./BaseConversation";

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

export class ChatGPTConversationVersion0 extends BaseConversation {
    lastUpdated: number = 0;

    lastDiscordMessageId: string | null = null;

    deleted: boolean = false;
    allHistory = '';
    numPrompts = 0;
    currentHistory = '';

    public isDirectMessage: boolean = false;

    constructor(
        threadId: string,
        public creatorId: string,
        public guildId: string,
        private username: string,
        private model: ModelName,
    ) {
        super(threadId);

        this.currentHistory = getOriginalPrompt(this.username);
        this.allHistory = this.currentHistory;
    }

    public static async handleRetrievalFromDB(fromDb: ChatGPTConversationVersion0) {
        const threadId = fromDb.threadId;

        let updatingPrompts = fromDb.numPrompts === undefined;
        if (updatingPrompts) {
            fromDb.numPrompts = fromDb.allHistory.split(END_OF_PROMPT).slice(3).length;
            logMessage(`<#${fromDb.threadId}>: ${fromDb.numPrompts} prompts.`);
        }

        const result = new ChatGPTConversationVersion0(threadId, fromDb.creatorId, fromDb.guildId, fromDb.username, fromDb.model ?? 'text-davinci-003');
        Object.assign(result, fromDb);

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

            let newHistoryTokens = encode(newHistory).length;
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
                    totalTokens += encode(userPrompts[numPromptsToRemove]).length;
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

        logMessage(`Found ${results.length} number of threads to check.`)

        await Promise.all(results.map(async result => {
            const fromDb = result.value as ChatGPTConversationVersion0;
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

    private async initialise() {
        logMessage(`Initialising conversation: <#${this.threadId}>.`);

        const currentBotId = discordClient.user!.id;

        if (this.isDirectMessage) {
            const channel = await discordClient.channels.fetch(this.threadId);

            if (!channel) {
                return;
            }

            if (!channel.isDMBased()) {
                return;
            }

            if (!channel.isTextBased()) {
                return;
            }

            const user = await discordClient.users.fetch(this.creatorId);
            if (!user) {
                // cannot find user
                return;
            }

            let newMessagesCollection: Collection<string, Message<false>>;

            if (this.lastDiscordMessageId == null) {
                newMessagesCollection = await channel.messages.fetch({
                    limit: 20,
                });
            } else {
                newMessagesCollection = await channel.messages.fetch({
                    after: this.lastDiscordMessageId,
                });
            }


            let newMessages = Array.from(newMessagesCollection.values());
            newMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

            logMessage(`DM [${user.username}] new messages: ${newMessages.length}.`);

            await Promise.all(newMessages.map(newMessage => newMessage.fetch()));

            newMessages = newMessages.filter(message => message.author.id !== currentBotId);

            if (newMessages.length === 0) {
                console.log('No new messages, ignoring.');
                return;
            }

            let lastMessage: Message<false> = newMessages[newMessages.length - 1];

            await trySendingMessage(channel, {
                content: `[[${getWhimsicalResponse(user.id)}

I will respond to this message now.]]`
            });

            this.handlePrompt(lastMessage.author, channel, lastMessage.content, lastMessage)
                .catch(e => logMessage('INITIALIZEThreads', 'failed to handle prompt...', e));

            return;
        }

        if (this.guildId === null) {
            logMessage('no guild for info: ', this);

            const guilds = Array.from(discordClient.guilds.cache.values());
            for (const server of guilds) {
                const channel = await server.channels.fetch(this.threadId);
                if (channel != null) {
                    logMessage('found guild for info: ', this, server.id);
                    this.guildId = server.id;
                    await this.persist();
                }
            }
        }

        const server = discordClient.guilds.cache.get(this.guildId);

        if (server == null) {
            logMessage('INITIALIZEThreads', 'server null for info', this.guildId);
            return;
        }

        const threadResponse = await this.tryGetThread(server);

        if (!threadResponse.success) {
            logMessage(`${this.threadId} <#${this.threadId}>: Failed to get thread, status: ${threadResponse.status}`);

            if (threadResponse.status === 404) {
                logMessage(`Thread ${this.threadId} <#${this.threadId}> deleted (or never existed)! Marking as deleted...`);
                this.deleted = true;
                await this.persist();

                // TODO remove
                return;
            }

            return;
        }

        const thread = threadResponse.thread;

        if (thread == null) {
            logMessage(`Thread <#${this.threadId}> deleted, ignoring.`);
            return;
        }

        if (!thread.isTextBased()) {
            return;
        }

        let newMessagesCollection: Collection<string, Message<true>>;

        if (this.lastDiscordMessageId == null) {
            newMessagesCollection = await thread.messages.fetch({
                limit: 20,
            });
        } else {
            newMessagesCollection = await thread.messages.fetch({
                after: this.lastDiscordMessageId,
            });
        }

        const newMessages = Array.from(newMessagesCollection.values());
        newMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

        logMessage(`Thread [${thread.guild.name}] <#${this.threadId}> new messages: ${newMessages.length}.`);

        if (newMessages.length === 0) {
            console.log('No new messages, ignoring.');
            return;
        }

        await Promise.all(newMessages.map(newMessage => newMessage.fetch()));

        let lastRelevantMessage: Message<true> | null = null;

        if (!thread.isThread()) {
            for (let newMessage of newMessages) {
                if (newMessage.author.id === currentBotId) {
                    continue;
                }

                if (newMessage.mentions.users.has(currentBotId)) {
                    lastRelevantMessage = newMessage;
                }
            }

            this.lastDiscordMessageId = newMessages[newMessages.length - 1].id;

            if (lastRelevantMessage != null) {
                logMessage(`Found message for thread: <#${this.threadId}>`, lastRelevantMessage.content);

                if (!messageReceivedInThread[this.threadId]) {
                    await trySendingMessage(thread, {
                        content: `[[${getWhimsicalResponse(lastRelevantMessage.author.id)}

I will respond to this message now.]]`
                    });
                    this.handlePrompt(lastRelevantMessage.author, thread, lastRelevantMessage.content, lastRelevantMessage)
                        .catch(e => logMessage('INITIALIZEThreads', 'failed to handle prompt...', e));
                } else {
                    logMessage(`A new message is being handled for <#${this.threadId}> already, no need to respond.`);
                }
            }

            await this.persist();

            return;
        }


        for (let newMessage of newMessages) {
            if (newMessage.author.id === this.creatorId) {
                lastRelevantMessage = newMessage;
            }
        }

        if (lastRelevantMessage != null) {
            logMessage(`Found message for thread: <#${this.threadId}>`, lastRelevantMessage.content);

            if (!messageReceivedInThread[this.threadId]) {
                await trySendingMessage(thread, {
                    content: `[[${getWhimsicalResponse(this.creatorId)}

I will respond to your last prompt now.]]`,
                });
                this.handlePrompt(lastRelevantMessage.author, thread, lastRelevantMessage.content, lastRelevantMessage)
                    .catch(e => logMessage('INITIALIZEThreads', 'failed to handle prompt...', e));
            } else {
                logMessage(`A new message is being handled for <#${this.threadId}> already, no need to respond.`);
            }
        } else {
            logMessage(`Found no messages from user for thread: <#${this.threadId}>`);
        }
        this.lastDiscordMessageId = newMessages[newMessages.length - 1].id;
        await this.persist();
    }
}
