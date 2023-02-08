import {db} from "../database/db";
import {MultiMessage} from "../shared/MultiMessage";
import {
    AnyThreadChannel,
    ChannelType,
    EmbedBuilder,
    EmbedType,
    Message,
    TextBasedChannel,
    ThreadAutoArchiveDuration,
    User
} from "discord.js";
import {logMessage, printArg} from "../utils/logMessage";
import {
    CreateCompletionResponse, CreateCompletionResponseUsage,
    CreateEmbeddingResponse,
    CreateModerationResponse,
    CreateModerationResponseResultsInnerCategoryScores,
    OpenAIApi
} from 'openai';
import {AxiosResponse} from "axios";
import {getEnv} from "../utils/GetEnv";
import {getMissingAPIKeyResponse} from "../utils/GetMissingAPIKeyResponse";
import {ModelName} from "./ModelInfo";
import {getOpenAIForId} from "./GetOpenAIForId";
import {trySendingMessage} from "./TrySendingMessage";
import {discordClient, getGuildName} from "../discord/discordClient";
import {BaseConversation} from "./BaseConversation";
import {getCustomPrompt, getOriginalPrompt} from "./GetOriginalPrompt";
import {CompletionError} from "./CompletionError";
import {encodeLength} from "./EncodeLength";
import {END_OF_PROMPT} from "./constants";
import {getLastMessagesUntilMaxTokens, getNumTokens} from "./GetLastMessagesUntilMaxTokens";
import {MessageHistoryItem} from "./MessageHistoryItem";
import {Filter, Vector} from 'pinecone-client';
import {v4} from "uuid";
import {PineconeMetadata} from "./PineconeMetadata";
import * as process from "process";
import {
    ConfigForIdType,
    getConfig,
    getConfigForId,
    getMessageCounter,
    MessageCounter,
    MessageCountInfo,
    saveMessageCounter
} from "./config";
import {getPineconeClient} from "./pinecone";
import {getMessageCountForUser, getNowPlusOneMonth} from "./GetMessageCountForUser";
import {extractImageDescriptions, ImageHandler} from "./ImageHandler";
import {KeyValuePair} from "../database/mongodb";
import {getDateString} from "../utils/GetDateString";
import {ConversationFactory} from "./ConversationFactory";
import {extractWolframDescriptions, WolframHandler} from "./WolframHandler";

const adminPingId = getEnv('ADMIN_PING_ID');
const CONFIG_COMMAND_NAME = getEnv('CONFIG_COMMAND_NAME');

// Binary search algorithm
function binarySearchIndex(numbers: number[], targetNumber: number): number {
    let start = 0;
    let end = numbers.length - 1;

    while (start <= end) {
        let mid = Math.floor((start + end) / 2);
        if (numbers[mid] === targetNumber) {
            return mid;
        } else if (numbers[mid] < targetNumber) {
            start = mid + 1;
        } else {
            end = mid - 1;
        }
    }
    return -1;
}

type HistoryConfig = {
    maxAllowed: number;
}

const messageFormattedDateTime = (date: Date) => {
    return date.toLocaleString('default', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).replace(/,\s+/g, ' ')
}

export const messageToPromptPart = (item: MessageHistoryItem): string => {
    const endOfPrompt = item.type === 'response' ? END_OF_PROMPT : '';

    const timeInfo = item.timestamp ? `[${messageFormattedDateTime(new Date(item.timestamp))}] ` : '';

    return `${timeInfo}${item.username}:${endOfPrompt} ${item.content.trimStart()}`;
}

type RelevancyMatch = { index: number, score: number, weighted: number, orderRanking: number };

type RelevancyResult = { match: RelevancyMatch, message: MessageHistoryItem };

type RelevancyCheckCache = {
    searchPerformed: boolean,
    results: RelevancyResult[],
};

export function ignoreInput(inputValue: string) {
    return inputValue.match(/^\s*~/) || inputValue.match(/^\s*\[\[\s*ps+t\s*\]\]/i);
}

export class ChatGPTConversation extends BaseConversation {
    static latestVersion = 3;

    messageHistory: string[] = [];

    messageHistoryMap: Record<string, MessageHistoryItem> = {};

    nextEmbedCheck: number = 0;

    customPrompt: string | null = null;

    temperature: number = 0.8;
    showUsername: boolean = true;
    makePrivate: boolean = false;

    summary: string = '';

    nextSummaryMessageCount: number = 5;

    allowExternals: boolean = false;
    shownAllowExternalsInfo: boolean = false;

    public version = ChatGPTConversation.latestVersion;

    constructor(
        threadId: string,
        creatorId: string,
        guildId: string,
        public username: string,
        private model: ModelName,
    ) {
        super(threadId, creatorId, guildId);
    }


    public static async handleRetrievalFromDB(fromDb: ChatGPTConversation) {
        let versionUpgraded = false;
        if (fromDb.version === 2) {
            logMessage(`trying to upgrade from v2 ${await BaseConversation.GetLinkableId(fromDb)}(${fromDb.threadId})!`);

            fromDb.messageHistoryMap = {};
            const historyItems = fromDb.messageHistory as any as MessageHistoryItem[];
            for (let i = 0; i < historyItems.length; i++) {
                let historyItem = historyItems[i];
                historyItem.id = v4();
                fromDb.messageHistoryMap[historyItem.id] = historyItem;

                fromDb.messageHistory[i] = historyItem.id;
            }
            fromDb.version = ChatGPTConversation.latestVersion;

            versionUpgraded = true;
        }

        const result = new ChatGPTConversation(
            fromDb.threadId,
            fromDb.creatorId,
            fromDb.guildId,
            fromDb.username,
            fromDb.model,
        );

        Object.assign(result, fromDb);

        if (versionUpgraded) {
            logMessage(`upgraded from v2 ${await BaseConversation.GetLinkableId(fromDb)}(${fromDb.threadId})!`);

            await result.persist();
        }

        return result;
    }

    async createHumanMessage(openai: OpenAIApi, user: User, message: string): Promise<MessageHistoryItem> {
        const messageId = v4();
        const timestamp = new Date().getTime();

        const newMessageItem: MessageHistoryItem = {
            id: messageId,
            content: message,
            embedding: null,
            numTokens: 0,
            type: 'human',
            username: user.username,
            userId: user.id,
            timestamp: timestamp,
            fixedTokens: true,
        };

        newMessageItem.numTokens = encodeLength(messageToPromptPart(newMessageItem));

        return newMessageItem;
    }

    async createResponseMessage(
        openai: OpenAIApi,
        botUsername: string,
        user: User,
        message: string,
        usageInfo: CreateCompletionResponseUsage[],
    ) {
        const messageId = v4();
        const timestamp = new Date().getTime();

        const embeddingId = await this.tryCreateEmbeddingForMessage(openai, user, message, timestamp, messageId);

        const newMessageItem: MessageHistoryItem = {
            id: messageId,
            content: message,
            embedding: embeddingId,
            numTokens: 0,
            type: 'response',
            username: botUsername,
            timestamp: new Date().getTime(),
            usageInfo,
            fixedTokens: true,
        };

        newMessageItem.numTokens = encodeLength(messageToPromptPart(newMessageItem));

        return newMessageItem;
    }


    private async tryCreateEmbeddingForMessage(openai: OpenAIApi, user: User, message: string, timestamp: number, messageId: string) {
        let embeddingId: string | null = null;
        const pinecone = await getPineconeClient();
        if (pinecone) {
            embeddingId = v4();

            try {
                const embeddings = await openai.createEmbedding({
                    user: user.id,
                    input: message,
                    model: 'text-embedding-ada-002',
                });

                const vector: Vector<PineconeMetadata> = {
                    id: embeddingId,
                    values: embeddings.data.data[0].embedding,
                    metadata: {
                        threadId: this.threadId,
                        timestamp: timestamp,
                        id: messageId,
                    },
                };

                await pinecone.upsert({
                    vectors: [vector],
                });
            } catch (e: any) {
                if (e.isAxiosError) {
                    // response = e.response;
                    logMessage(`Could not create embedding... ${await this.getLinkableId()}`, e.response.data);
                } else {
                    const adminPingId = getEnv('ADMIN_PING_ID')
                    logMessage(`${adminPingId ? `<@${adminPingId}>` : ''}! Could not create embedding... ${
                            await this.getLinkableId()}`,
                        e);
                }


                embeddingId = null;
            }
        }
        return embeddingId;
    }

    private async SendPromptToGPTChat(
        config: ConfigForIdType,
        usingOpenAIForServer: boolean,
        openai: OpenAIApi,
        user: User,
        message: string,
        onProgress: (result: string, finished: boolean) => void,
    ): Promise<void> {
        const modelInfo = config.modelInfo[this.model];

        let finished = false;
        let numRetries = 0;
        const maxRetries = 3;
        let latestResponseText = '';
        let usageInfo: CreateCompletionResponseUsage[] = [];

        const relevancyResultsCache: RelevancyCheckCache = {
            searchPerformed: false,
            results: [],
        };

        const inputMessageItem = await this.createHumanMessage(openai, user, message);

        while (!finished) {
            let response: AxiosResponse<CreateCompletionResponse> | undefined;

            try {
                const maxTokens = modelInfo.MAX_TOKENS_PER_RESPONSE;

                const fullPrompt = await this.getFullPrompt(config, openai, user, inputMessageItem, latestResponseText, relevancyResultsCache);

                response = await openai.createCompletion({
                    model: this.model,
                    prompt: fullPrompt,
                    temperature: this.temperature,
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
                    finished = true;
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

                    onProgress(`[[Whoops, ran out of tokens :( Contact your OpenAI account holder please.${usingOpenAIForServer ? `

You can alternatively supply your own API key to me by sending me the /${CONFIG_COMMAND_NAME} command in a DM.` : ''}]]`, true);
                } else if (data.error?.message) {
                    logMessage('Bad response', response.data, {numRetries, maxRetries});

                    if (numRetries < maxRetries) {
                        numRetries++;
                        continue;
                    }

                    onProgress(`[[Error from OpenAI servers: "${data.error.message}"]]`, true);
                } else {
                    onProgress('[[Unknown error from OpenAI servers. Please ping the bot owner for help.]]', true);
                }

                logMessage('Bad response', response.data);
                finished = true;
                break;
            }

            const choices = response.data.choices;
            if (choices.length !== 1) {
                logMessage('Not enough choices?!');
                finished = true;

                return;
            }

            const choice = choices[0];

            const text = choice.text;

            if (text == undefined) {
                logMessage('No text?!');
                finished = true;

                return;
            }

            latestResponseText += text;
            const currentUsage = response.data.usage;
            if (currentUsage) {
                usageInfo.push(currentUsage);
            }

            if (choice.finish_reason !== 'stop') {
                if (onProgress) {
                    onProgress(latestResponseText, false);
                }

                finished = false;
            } else {
                if (onProgress) {
                    onProgress(latestResponseText, true);
                }

                finished = true;

                const embeddingPromise = this.tryCreateEmbeddingForMessage(
                    openai,
                    user,
                    inputMessageItem.content,
                    inputMessageItem.timestamp!,
                    inputMessageItem.id,
                );

                const createResponseMessagePromise = this.createResponseMessage(openai, this.username, user, latestResponseText, usageInfo);

                inputMessageItem.embedding = await embeddingPromise;
                const responseMessage = await createResponseMessagePromise;

                this.messageHistoryMap[inputMessageItem.id] = inputMessageItem;
                this.messageHistory.push(inputMessageItem.id);

                this.messageHistory.push(responseMessage.id);
                this.messageHistoryMap[responseMessage.id] = responseMessage;

                logMessage(`RESPONSE: ${await this.getLinkableId()} ${latestResponseText}`, 'usage', response.data.usage);

                await this.persist();

                return;
            }
        }

        return;
    }

    async handlePrompt(
        user: User,
        channel: TextBasedChannel,
        inputValue: string,
        messageToReplyTo?: Message<boolean>,
    ): Promise<void> {
        if (ignoreInput(inputValue)) {
            return;
        }

        const userId = user.id;

        if (this.makePrivate && !channel.isDMBased() && !channel.isThread() && channel.isTextBased()) {
            if (channel.type === ChannelType.GuildText) {
                const threadName = `${user.username} - ${inputValue ?? getDateString(new Date())}`
                    .substring(0, 80);

                const newThread: AnyThreadChannel = await channel.threads.create({
                    name: threadName,
                    reason: 'ChatGPT',
                    autoArchiveDuration: ThreadAutoArchiveDuration.OneHour,
                    type: ChannelType.PrivateThread,
                }) as AnyThreadChannel;


                const conversation = ConversationFactory.create(newThread.id, userId, channel.guildId, discordClient.user!.username, this.model);
                conversation.username = this.username;
                conversation.customPrompt = this.customPrompt;
                conversation.temperature = this.temperature;
                conversation.showUsername = this.showUsername;

                await conversation.persist();

                await trySendingMessage(newThread, {
                    embeds: [
                        new EmbedBuilder()
                            .setAuthor({
                                name: user.username,
                                iconURL: user.avatarURL() ?? undefined,
                            })
                            .setDescription(inputValue),
                    ],
                });

                await newThread.members.add(userId);

                await conversation.handlePrompt(
                    user,
                    newThread,
                    inputValue,
                );

                const newMessage = await trySendingMessage(newThread, {
                    content: `[[<@${userId}>, ${conversation.username} will respond to your messages in this thread.]]`,
                });

                if (messageToReplyTo) {
                    await messageToReplyTo.react('✅');
                }

                if (newMessage) {
                    conversation.lastDiscordMessageId = newMessage.id;

                    await conversation.persist();
                }
            }

            return;
        }

        let openai: OpenAIApi | undefined;

        logMessage(`PROMPT: [${user.username}] in ${await this.getLinkableId()}: ${inputValue}`);

        const configId = this.isDirectMessage ? userId : this.guildId;

        let usingOpenAIForServer = false;
        let currentConfig: ConfigForIdType = await getConfigForId(userId);

        if (this.isDirectMessage || currentConfig.useKeyInServersToo) {
            openai = await getOpenAIForId(userId);
        }

        if (!this.isDirectMessage && !openai) {
            openai = await getOpenAIForId(this.guildId);
            usingOpenAIForServer = true;
            currentConfig = await getConfigForId(configId);
        }

        if (usingOpenAIForServer && currentConfig.maxMessagePerUser !== -1) {
            const messageCounter = await getMessageCounter(configId);
            const messageCountForUser: MessageCountInfo = getMessageCountForUser(messageCounter, userId);

            if (messageCountForUser.nextReset < new Date().getTime()) {
                messageCountForUser.limitCount = 0;
                messageCountForUser.imageLimitCount = 0;
                messageCountForUser.nextReset = getNowPlusOneMonth();

                messageCounter[userId] = messageCountForUser;
                await saveMessageCounter(configId, messageCounter);
            }

            if (messageCountForUser.limitCount > currentConfig.maxMessagePerUser) {
                const guild = await discordClient.guilds.fetch(this.guildId);
                const member = await guild.members.fetch(userId);

                if (!currentConfig
                    .exceptionRoleIds
                    .some(exceptionRoleId => member.roles.cache.has(exceptionRoleId))) {

                    await trySendingMessage(channel, {
                        content: `Reached max limit of messages for ${user.username}.
                        
${currentConfig.messageExpiredNote ?
                            `${currentConfig.messageExpiredNote}` :
                            'Please contact a server admin to get access for unlimited messages.'}

Alternatively, you can supply your OpenAI API key to me by using the \`/${CONFIG_COMMAND_NAME}\` in a DM to me.`
                    }, messageToReplyTo);

                    return;
                }
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


        if (userId === adminPingId) {
            if (inputValue === '<EMBED>') {
                await this.tryEmbedMany(user, openai, channel, messageToReplyTo);
                return;
            }

            if (inputValue === '<TEST_MSG_LIMIT>') {
                await trySendingMessage(channel, {
                    content: `Reached max limit of messages for ${user.username}.
                        
${currentConfig.messageExpiredNote ? `${currentConfig.messageExpiredNote}`
                        : 'Please contact a server admin to get access for unlimited messages.'}

Alternatively, you can supply your OpenAI API key to me by using the \`/${CONFIG_COMMAND_NAME}\` in a DM to me.`
                }, messageToReplyTo);
                return;
            }

            if (inputValue === '<CRASH>') {
                const userHasPermissions = user.id === adminPingId;

                if (messageToReplyTo) {
                    this.lastDiscordMessageId = messageToReplyTo.id;
                    await this.persist();
                }
                process.exit(1);
            }

            if (inputValue === '<SERVERINFO>') {
                try {
                    const guilds = await discordClient.guilds.fetch();

                    const guildInfo = await Promise.all(guilds.map(async guild => {
                        try {
                            const guildInfo = await getConfigForId(guild.id);

                            const hasAPIKey = Boolean(guildInfo && guildInfo.openAIApiKey);

                            const threads: KeyValuePair<ChatGPTConversation>[] = await db.collection!.find({
                                "value.guildId": guild.id,
                            }).toArray();

                            const guildObject = await discordClient.guilds.cache.get(guild.id);
                            const member = await guildObject?.members.fetch(discordClient.user!.id);
                            let joined: Date | null = null;

                            if (member) {
                                joined = member.joinedAt;
                            }

                            return {
                                id: guild.id,
                                name: guild.name,
                                success: true,
                                'hasAPI': hasAPIKey,
                                numThreads: threads.length,
                                numLastVersionThreads: threads.filter(thread => thread.value.version === ChatGPTConversation.latestVersion).length,
                                numMessages: threads.reduce((sum, thread) => {
                                    if (thread.value.version === ChatGPTConversation.latestVersion) {
                                        return sum + thread.value.messageHistory.length;
                                    }

                                    return sum;
                                }, 0),
                                joined,
                            };
                        } catch (e) {
                            return {
                                success: false,
                                error: e,
                            };
                        }
                    }));

                    const string = guildInfo.sort((a, b) => {
                        if (!a.success || !a.joined) {
                            return -1;
                        }
                        if (!b.success || !b.joined) {
                            return 1;
                        }

                        return a.joined.getTime() - b.joined.getTime();
                    }).map(info => {
                        return `${info.id}: ${info.name}: ${JSON.stringify(info)}`;
                    }).join('\n');

                    await this.sendReply(channel, `Guilds:
\`\`\`
${string}
\`\`\``);

                } catch (e) {
                    logMessage('Cannot get serverinfo: ', e);
                }
                return;
            }
        }

        const botConfig = await getConfig();

        if (inputValue === '<TOGGLE_EXTERNALS>' && user.id === this.creatorId && channel.isThread()) {
            this.allowExternals = !this.allowExternals;

            await this.sendReply(channel, `${this.allowExternals ? 'Allowing anyone to converse in this thread.' :
                'Not allowing anyone else to converse in this thread any more.'}

To toggle again, type \`<TOGGLE_EXTERNALS>\` in here again.`, messageToReplyTo);

            await this.persist();

            return;
        }

        if (inputValue === '<DEBUG>') {
            const userOrServerHasPermissions = user.id === adminPingId
                || botConfig.promptPermissions.includes(user.id);

            if (userOrServerHasPermissions) {
                const {lastUpdated, nextSummaryMessageCount} = this;
                const totalTokens = this.messageHistory.map(id => this.messageHistoryMap[id])
                    .reduce((sum, item) => sum + getNumTokens(item), 0);
                const responseTokens: CreateCompletionResponseUsage = this.messageHistory.map(id => this.messageHistoryMap[id])
                    .reduce((sum, item) => {
                        if (item.type === 'response') {
                            if (item.usageInfo) {
                                for (let usage of item.usageInfo) {
                                    sum.completion_tokens += usage.completion_tokens;
                                    sum.prompt_tokens += usage.prompt_tokens;
                                    sum.total_tokens += usage.total_tokens;
                                }
                            }
                        }
                        return sum;
                    }, {
                        prompt_tokens: 0,
                        completion_tokens: 0,
                        total_tokens: 0,
                    });
                const numMessages = this.messageHistory.length;
                const debugInfo = {
                    lastUpdated,
                    numMessages,
                    totalTokens,
                    responseTokens,
                } as any;

                if (channel.isThread()) {
                    debugInfo.nextSummaryMessageCount = nextSummaryMessageCount;
                }
                const debugMessage = `Debug: 
\`\`\`json
${JSON.stringify(debugInfo, null, '  ')}
\`\`\``;

                await trySendingMessage(channel, {content: debugMessage}, messageToReplyTo);
            }

            return;
        }

        const deletePrefix = '<DELETE>';
        if (inputValue.startsWith(deletePrefix)) {
            const userOrServerHasPermissions = user.id === adminPingId
                || botConfig.promptPermissions.includes(user.id);

            if (userOrServerHasPermissions) {
                let rest = inputValue.slice(deletePrefix.length);

                let toDelete = 1;
                const param = parseInt(rest);
                if (!isNaN(param)) {
                    toDelete = param;
                }

                const deletedIndices = await this.deleteMessages(toDelete);

                await trySendingMessage(channel, {
                    content: `Deleted: \n${deletedIndices.length} message(s).`,
                });
            }

            return;
        }

        const promptPrefix = '<PROMPT>';
        if (inputValue.startsWith(promptPrefix) && userId === adminPingId) {
            const input = inputValue.slice(promptPrefix.length);

            const inputMessageItem = await this.createHumanMessage(openai, user, input);

            const fullPrompt = await this.getFullPrompt(currentConfig, openai, user, inputMessageItem, '', {
                searchPerformed: false,
                results: [],
            }, true);

            const prompt = `===PROMPT===
${fullPrompt}
===END PROMPT - TOKENS: ${encodeLength(fullPrompt)} ===`;

            await new MultiMessage(channel, undefined, messageToReplyTo).update(prompt, true);

            return;
        }

        const historyPrefix = '<HISTORY>';
        if (inputValue.startsWith(historyPrefix) && userId === adminPingId) {
            const historyConfig = await db.get<HistoryConfig>(`HISTORY-CONFIG-${userId}`);

            if (!historyConfig) {
                await new MultiMessage(channel, undefined, messageToReplyTo)
                    .update('Please ping the bot owner to allow you to use the <HISTORY> command.', true);
                return;
            }

            let rest = inputValue.slice(historyPrefix.length);

            let toShow = 1;
            const param = parseInt(rest);
            if (!isNaN(param)) {
                toShow = Math.min(historyConfig.maxAllowed, param);
            }

            const history = this.messageHistory.slice(this.messageHistory.length - toShow).map(id => this.messageHistoryMap[id]);
            const response = `History: \n${history.map(item => messageToPromptPart(item)).join('\n')}`;

            await this.sendReply(channel, response, messageToReplyTo);

            return;
        }

        const queryPrefix = '<QUERY>';
        if (inputValue.startsWith(queryPrefix) && userId === adminPingId) {
            const pinecone = await getPineconeClient();
            if (pinecone != null) {
                await this.testQuery(inputValue, queryPrefix, channel, user, openai, messageToReplyTo);
                return;
            }

            return;
        }


        try {
            channel.sendTyping().catch();
        } catch (e) {
            logMessage(`${await this.getLinkableId()} Cannot send typing..`, e);
        }

        const multi = new MultiMessage(channel, undefined, messageToReplyTo);

        try {
            const moderationResponse: AxiosResponse<CreateModerationResponse> = await openai.createModeration({
                input: inputValue,
            }) as any;

            const moderationScores = moderationResponse.data.results[0].category_scores;
            const entries = Object.entries(moderationScores);

            const failures = entries.filter(([key, value]) => {
                return value > botConfig.moderationThreshold[key as keyof CreateModerationResponseResultsInnerCategoryScores];
            });

            logMessage(`${await this.getLinkableId()} Moderation:`, Object.fromEntries(entries.map(([key, value]) => [key, value.toFixed(2)])));

            if (failures.length > 0) {
                await multi.update(`[[MESSAGE BLOCKED!

OpenAI moderation failed:

${failures.map(([key]) => {
                    return `${key}`;
                }).join('\n')}]]`, true);

                return;
            }
        } catch (e) {
            logMessage(`${await this.getLinkableId()} moderation fail`, e);
        }

        let promiseComplete = false;

        if (messageToReplyTo) {
            this.lastDiscordMessageId = messageToReplyTo.id;

            await this.handleSpecialKeywords(openai!, inputValue, usingOpenAIForServer, userId, currentConfig, channel, messageToReplyTo);

            await this.persist();
        }

        const sendPromise = this.SendPromptToGPTChat(
            currentConfig,
            usingOpenAIForServer,
            openai,
            user,
            inputValue,
            async (result, finished) => {
                if (this.customPrompt && this.showUsername) {
                    await multi.update(`${this.username}:${result}`, finished);
                } else {
                    await multi.update(result, finished);
                }

                if (finished) {
                    promiseComplete = true;

                    if (multi.messageList.length > 0) {
                        const lastMessage = multi.messageList[multi.messageList.length - 1];
                        this.lastDiscordMessageId = lastMessage.message.id;
                        await this.handleSpecialKeywords(openai!, result, usingOpenAIForServer, userId, currentConfig, channel, lastMessage.message);

                        await this.persist();
                    }
                }
            }
        );

        sendPromise.finally(() => {
            // complete it in case it somehow failed to send finished part
            promiseComplete = true;
        })

        const intervalId = setInterval(async () => {
            if (promiseComplete) {
                clearInterval(intervalId);
                return;
            }

            try {
                await channel.sendTyping();
            } catch (e) {
                logMessage(`${await this.getLinkableId()} Cannot send typing..`, e);
            }
        }, 5000);

        await sendPromise;


        if (channel.isThread()) {
            if (this.messageHistory.length > this.nextSummaryMessageCount) {
                await this.trySummariseThread(openai, userId, channel);
            }
        }

        if (usingOpenAIForServer) {
            const messageCounter = await getMessageCounter(this.guildId);

            const messageCountForUser: MessageCountInfo = getMessageCountForUser(messageCounter, userId);

            messageCountForUser.count++;
            messageCountForUser.limitCount++;

            if (currentConfig.maxMessagePerUser !== -1
                && !messageCountForUser.warned
                && messageCountForUser.limitCount > currentConfig.maxMessagePerUser * 0.75) {
                const guild = await discordClient.guilds.fetch(this.guildId);
                const member = await guild.members.fetch(userId);
                if (!currentConfig
                    .exceptionRoleIds
                    .some(exceptionRoleId => member.roles.cache.has(exceptionRoleId))) {

                    await channel.send({
                        content: '',
                        embeds: [
                            new EmbedBuilder()
                                .setTitle('Message Limit')
                                .setDescription(`<@${userId}> - You have sent ${messageCountForUser.limitCount} messages out of the maximum allowed ${currentConfig.maxMessagePerUser}.
                             
When you reach ${currentConfig.maxMessagePerUser}, you won't be able to send any more messages until an Admin allows it, or until you provide your own API key to me.

${currentConfig.messageExpiredNote ? `${currentConfig.messageExpiredNote}

` : ''}You can provide your API key by using \`/${CONFIG_COMMAND_NAME}\` in a DM to me.
 
Please be aware of this and contact an Admin if you have any questions.

Thank you for your understanding.`),
                        ]
                    });

                    messageCountForUser.warned = true;
                }
            }

            messageCounter[userId] = messageCountForUser;
            await saveMessageCounter(this.guildId, messageCounter);
        }

        if (multi.messageList.length > 0) {
            this.lastDiscordMessageId = multi.messageList[multi.messageList.length - 1].message.id;
            await this.persist();
        }
    }

    private async handleSpecialKeywords(openai: OpenAIApi,
                                        input: string,
                                        usingOpenAIForServer: boolean,
                                        userId: string,
                                        currentConfig: ConfigForIdType,
                                        channel: TextBasedChannel,
                                        messageToReplyTo: Message<boolean>,
    ) {
        const imageDescriptions = await this.getImageDescriptions(input, usingOpenAIForServer, userId, currentConfig, channel);

        if (imageDescriptions.length) {
            ImageHandler.handle(openai, imageDescriptions, userId, messageToReplyTo).catch();
        }

        const WOLFRAM_APP_ID = getEnv('WOLFRAM_APP_ID')!;
        if (WOLFRAM_APP_ID) {
            const wolframDescriptions = extractWolframDescriptions(input);

            if (wolframDescriptions.length) {
                WolframHandler.handle(wolframDescriptions, userId, messageToReplyTo).catch();
            }
        }
    }

    private async trySummariseThread(openai: OpenAIApi, userId: string, channel: AnyThreadChannel) {
        try {
            const allMessagesInHistory = this.messageHistory.map(id => this.messageHistoryMap[id]);

            const lastMessages = getLastMessagesUntilMaxTokens(allMessagesInHistory, 1000, true);

            if (lastMessages.length < 4) {
                return;
            }

            this.nextSummaryMessageCount = this.messageHistory.length + 10;
            await this.persist();

            const response: AxiosResponse<CreateCompletionResponse> = await openai.createCompletion({
                model: this.model,
                prompt: `Please create a name for a discord thread that contains this conversation:

${lastMessages.map(item => messageToPromptPart(item)).join('\n')}`,
                temperature: this.temperature,
                max_tokens: 512,
                top_p: 0.9,
                frequency_penalty: 0,
                presence_penalty: 0,
                user: userId,
            }) as any;

            this.summary = response.data.choices[0].text!;

            logMessage(`Summary for ${await this.getLinkableId()}: ${this.summary}.
Source: ${lastMessages}`);

            await channel.setName(this.summary.slice(0, 90));
        } catch (e) {
            logMessage(`Could not name thread ${await this.getLinkableId()}`, e);
        }
    }

    private async getImageDescriptions(inputValue: string,
                                       usingOpenAIForServer: boolean,
                                       userId: string,
                                       currentConfig: ConfigForIdType,
                                       channel: TextBasedChannel,
    ) {
        let descriptions = extractImageDescriptions(inputValue);

        if (descriptions.length === 0) {
            return [];
        }

        const messageCounter = await getMessageCounter(this.guildId);

        if (descriptions.length > 0) {
            const userHasExceptionRole = await this.userHasExceptionRole(userId, currentConfig);

            const userShouldBeRestricted = usingOpenAIForServer
                && currentConfig.maxImagePerUser != -1
                && userId !== adminPingId
                && !userHasExceptionRole
            ;

            if (userShouldBeRestricted) {
                const messageCountForUser: MessageCountInfo = getMessageCountForUser(messageCounter, userId);

                if (messageCountForUser.imageLimitCount >= currentConfig.maxImagePerUser) {
                    await channel.send({
                        content: '',
                        embeds: [
                            new EmbedBuilder()
                                .setTitle('Image Limit')
                                .setDescription(`
Detected [[DRAW]] commands but image limit was reached.
                                    
The bot has generated ${messageCountForUser.imageLimitCount} images out of the maximum allowed ${currentConfig.maxImagePerUser}.

The bot will not be able to generate any more images for you in this server until the server Admin allows for more.

This limit resets every month.
                             
If you'd like to use your own API key to generate images, you can provide your API key by using \`/${CONFIG_COMMAND_NAME}\` in a DM to me.

You can contact a server Admin if you have any questions.

Thank you for your understanding.`),
                        ]
                    });

                    descriptions = [];
                } else {
                    descriptions = this.trimDescriptions(messageCounter, userId, currentConfig, descriptions);

                    if (descriptions.length > 0) {
                        messageCountForUser.imageCount += descriptions.length;
                        messageCountForUser.imageLimitCount += descriptions.length;

                        messageCounter[userId] = messageCountForUser;
                        await saveMessageCounter(this.guildId, messageCounter);
                    }
                }
            }
        }
        return descriptions;
    }

    private async userHasExceptionRole(userId: string, currentConfig: ConfigForIdType) {
        const guild = await discordClient.guilds.fetch(this.guildId);
        const member = await guild.members.fetch(userId);

        return currentConfig
            .exceptionRoleIds
            .some(exceptionRoleId => member.roles.cache.has(exceptionRoleId));
    }

    private trimDescriptions(
        messageCounter: MessageCounter,
        userId: string,
        currentConfig: ConfigForIdType,
        descriptions: string[],
    ) {
        const messageCountForUser: MessageCountInfo = getMessageCountForUser(messageCounter, userId);
        if (messageCountForUser.imageLimitCount >= currentConfig.maxImagePerUser) {
            return [];
        }
        const remainingImages = Math.max(currentConfig.maxImagePerUser - messageCountForUser.imageLimitCount, 0);

        if (remainingImages > 0) {
            return descriptions.slice(0, remainingImages);
        } else {
            return [];
        }
    }

    public async deleteMessages(toDelete: number) {
        const deletedIndices = this.messageHistory.splice(this.messageHistory.length - toDelete);
        const pinecone = await getPineconeClient();
        if (pinecone != null) {
            const embedIdsToDelete = deletedIndices
                .map(id => this.messageHistoryMap[id].embedding)
                .filter(item => item !== null) as string[];

            try {
                await pinecone.delete({
                    ids: embedIdsToDelete,
                });

                logMessage('Deleted ids from pinecone:', embedIdsToDelete);
            } catch (e) {
                logMessage('Failed to delete from pinecone: ', e);
            }
        }

        for (const id of deletedIndices) {
            delete this.messageHistoryMap[id];
        }

        await this.persist();
        return deletedIndices;
    }

    private async tryEmbedMany(user: User, openai: OpenAIApi, channel?: TextBasedChannel, messageToReplyTo?: Message<boolean>) {
        const config = await getConfig();

        const pinecone = await getPineconeClient();
        if (pinecone != null && config.maxMessagesToEmbed > 0) {
            const withoutEmbedding = this.messageHistory
                .map(id => this.messageHistoryMap[id])
                .filter(item => !item.embedding);

            let timestampsFixed = false;
            for (let i = 0; i < withoutEmbedding.length; i++) {
                let withoutEmbeddingElement = withoutEmbedding[i];
                if (!withoutEmbeddingElement.timestamp) {
                    withoutEmbeddingElement.timestamp = this.lastUpdated - 1000 * (withoutEmbedding.length - i);
                    timestampsFixed = true;
                }
            }

            if (timestampsFixed) {
                await this.persist();
            }

            const firstN = withoutEmbedding.slice(0, config.maxMessagesToEmbed);

            if (firstN.length === 0) {
                if (messageToReplyTo && channel) {
                    await this.sendReply(channel, `No need to embed anything.`, messageToReplyTo);
                }

                return;
            }

            if (messageToReplyTo && channel) {
                await this.sendReply(channel, `Preparing to embed ${firstN.length} messages...`, messageToReplyTo);
            } else {
                logMessage(`${await this.getLinkableId()}: Preparing to embed ${firstN.length} messages...`);
            }

            let embeddings: AxiosResponse<CreateEmbeddingResponse>;
            try {
                embeddings = await openai.createEmbedding({
                    user: user.id,
                    input: firstN.map(item => item.content),
                    model: 'text-embedding-ada-002',
                }) as any;
            } catch (e) {
                if (messageToReplyTo && channel) {
                    await this.sendReply(channel, `Cannot create embeddings: ${printArg(e)}`, messageToReplyTo);
                } else {
                    logMessage(`${await this.getLinkableId()}: Cannot create embeddings`, e);
                }
                return;
            }

            if (messageToReplyTo && channel) {
                await this.sendReply(channel, `Embeddings created for ${firstN.length} messages.`, messageToReplyTo);
            } else {
                logMessage(`${await this.getLinkableId()}: Embeddings created for ${firstN.length} messages.`);
            }

            const vectors: Vector<PineconeMetadata>[] = firstN.map((item, index) => {
                return {
                    id: v4(),
                    values: embeddings.data.data[index].embedding,
                    metadata: {
                        threadId: this.threadId,
                        timestamp: item.timestamp!,
                        id: item.id,
                    },
                }
            });

            try {
                if (messageToReplyTo && channel) {
                    await this.sendReply(channel, `Inserting to pinecone...`, messageToReplyTo);
                } else {
                    logMessage(`${await this.getLinkableId()}: Inserting to pinecone...`);
                }

                await pinecone.upsert({
                    vectors
                });

                for (let i = 0; i < firstN.length; i++) {
                    let item = firstN[i];
                    item.embedding = vectors[i].id;
                }

                await this.persist();

                if (messageToReplyTo && channel) {
                    await this.sendReply(channel, 'upsert completed!', messageToReplyTo);
                } else {
                    logMessage(`${await this.getLinkableId()}: upsert completed!`);
                }
            } catch (e) {
                if (messageToReplyTo && channel) {
                    await this.sendReply(channel, `Error: ${printArg(e)}`, messageToReplyTo);
                } else {
                    logMessage(`${await this.getLinkableId()}: Error while trying to save embeddings: ${printArg(e)}`);
                }
            }
        }

        return;
    }

    private async testQuery(
        inputValue: string,
        queryPrefix: string,
        channel: TextBasedChannel,
        user: User,
        openai: OpenAIApi,
        messageToReplyTo: Message<boolean> | undefined,
    ) {
        const pinecone = await getPineconeClient();

        if (!pinecone) {
            return [];
        }

        let rest = inputValue.slice(queryPrefix.length);

        const firstCommaIndex = rest.indexOf(',');
        if (firstCommaIndex == -1) {
            await trySendingMessage(channel, {
                content: `<QUERY> [time-weight (from 0 to 1)], PROMPT MESSAGE`,
            });

            return;
        }

        const orderWeight = parseFloat(rest.slice(0, firstCommaIndex).trim());

        if (isNaN(orderWeight) || orderWeight < 0 || orderWeight > 1) {
            await trySendingMessage(channel, {
                content: `<QUERY> [time-weight (NUMBER from 0 to 1)], PROMPT MESSAGE`,
            });

            return;
        }

        const input = rest.slice(firstCommaIndex + 1).trimStart();

        let embeddings: AxiosResponse<CreateEmbeddingResponse>;
        try {
            embeddings = await openai.createEmbedding({
                user: user.id,
                input: input,
                model: 'text-embedding-ada-002',
            }) as any as AxiosResponse<CreateEmbeddingResponse>;
        } catch (e) {
            logMessage(`${await this.getLinkableId()}: Cannot create embeddings`, e);

            return;
        }

        const vector = embeddings.data.data[0].embedding;

        const messages = await this.getRelevantMessages(user, openai, orderWeight, vector);

        if (messages.length === 0) {
            await this.sendReply(channel,
                `No relevant messages found. Either no pinecone config, or ran out of OpenAI tokens.`,
                messageToReplyTo);

            return;
        }

        const topK = messages
            .sort((a, b) => {
                return b.match.weighted - a.match.weighted;
            })
            .slice(0, 10)
            .sort((a, b) => {
                return a.match.index - b.match.index;
            });

        const resultString = topK.map(item => {
            const indexString = item.match.index.toString().padStart(4, '0');
            const scoreString = item.match.score.toFixed(3);
            const orderString = item.match.orderRanking.toFixed(3);
            const weightString = item.match.weighted.toFixed(3);
            return `- ${indexString} S:${scoreString} O:${orderString} W:${weightString} ${getNumTokens(item.message).toString().padStart(4, '0')}
${messageToPromptPart(item.message)}`;
        }).join('\n');

        await this.sendReply(channel, `Result:\n${resultString}`, messageToReplyTo);

        return;
    }

    private async getFullPrompt(
        config: ConfigForIdType,
        openai: OpenAIApi,
        user: User,
        inputMessageItem: MessageHistoryItem,
        latestResponseText: string,
        relevancyCheckCache: RelevancyCheckCache,
        debug: boolean = false,
    ) {
        let initialPrompt: string;

        if (this.customPrompt) {
            initialPrompt = getCustomPrompt(this.username, this.customPrompt);
        } else {
            initialPrompt = getOriginalPrompt(this.username);
        }
        const modelInfo = config.modelInfo[this.model];

        const numInitialPromptTokens = encodeLength(initialPrompt);
        const currentResponseTokens = encodeLength(latestResponseText);

        const inputTokens = encodeLength(messageToPromptPart(inputMessageItem));

        let availableTokens = modelInfo.MAX_ALLOWED_TOKENS - numInitialPromptTokens - currentResponseTokens - inputTokens;

        const allMessagesInHistory = this.messageHistory.map(id => this.messageHistoryMap[id]);
        let needFix = false;
        const totalTokensFromHistory = allMessagesInHistory.reduce((sum, item) => {
            if (!item.fixedTokens) {
                needFix = true;
            }
            return sum + getNumTokens(item);
        }, 0);

        if (needFix) {
            await this.persist();
        }

        if (totalTokensFromHistory < availableTokens) {
            // use only messages, it's simpler

            return `${initialPrompt}${debug ? '\nDEBUG: ALL MESSAGES:' : ''}
${allMessagesInHistory.concat(inputMessageItem).map(messageToPromptPart).join('\n')}
[${messageFormattedDateTime(new Date())}] ${this.username}:${END_OF_PROMPT}${latestResponseText}`;
        }

        const tokensForRecentMessages = Math.min(config.maxTokensForRecentMessages, availableTokens);

        const latestMessages = getLastMessagesUntilMaxTokens(
            allMessagesInHistory,
            tokensForRecentMessages,
            true,
        );

        if (!relevancyCheckCache.searchPerformed) {
            // check relevancy using last 4 messages.
            const last4 = allMessagesInHistory.slice(-4);

            const relevantMessageInput = last4
                .map(item => item.content)
                .concat(inputMessageItem.content)
                .join('\n');

            let embeddings: AxiosResponse<CreateEmbeddingResponse>;
            let vector: Array<number> | null = null;

            try {
                embeddings = await openai.createEmbedding({
                    user: user.id,
                    input: relevantMessageInput,
                    model: 'text-embedding-ada-002',
                }) as any as AxiosResponse<CreateEmbeddingResponse>;

                vector = embeddings.data.data[0].embedding;
            } catch (e) {
                logMessage(`${await this.getLinkableId()}: Cannot create embeddings`, e);
            }

            const relevantMessages = await this.getRelevantMessages(user, openai, 0.05, vector);

            relevantMessages.sort((a, b) => {
                return b.match.weighted - a.match.weighted;
            });

            relevancyCheckCache.searchPerformed = true;

            relevancyCheckCache.results = relevantMessages;
        }


        const unseenRelevantMessages = relevancyCheckCache
            .results
            .filter(item => !latestMessages.find(message => message.id === item.message.id));

        const latestMessagesPlusNewMessage = latestMessages.concat(inputMessageItem);

        // get top N until MAX_ALLOWED_TOKENS is reached?
        const usedTokensFromMessages = latestMessagesPlusNewMessage
            .reduce((sum, item) => sum + getNumTokens(item), 0);

        availableTokens -= usedTokensFromMessages;

        const includedRelevantMessages: RelevancyResult[] = [];
        for (const relevantMessage of unseenRelevantMessages) {
            if (getNumTokens(relevantMessage.message) < availableTokens) {
                includedRelevantMessages.push(relevantMessage);
                availableTokens -= getNumTokens(relevantMessage.message);
            }

            if (availableTokens < 50) {
                break;
            }
        }

        includedRelevantMessages
            .sort((a, b) => a.match.index - b.match.index);

        let relevantPrefix: string;
        let relevantSuffix: string;

        if (debug) {
            relevantPrefix = `---RELEVANT--`;
            relevantSuffix = `---END RELEVANT - TOKENS: ${includedRelevantMessages.reduce((sum, item) => sum + getNumTokens(item.message), 0)} ---`;
        } else {
            relevantPrefix = 'Earlier history:';
            relevantSuffix = 'Recent history:';
        }

        const latestMessagesAndCurrentPrompt = latestMessagesPlusNewMessage.map(messageToPromptPart).join('\n');

        return `${initialPrompt}
${includedRelevantMessages.length > 0 ? `${relevantPrefix}
${includedRelevantMessages.map(item => messageToPromptPart(item.message)).join('\n')}
${includedRelevantMessages.length > 0 ? relevantSuffix : ''}
` : ''}
${latestMessagesAndCurrentPrompt}${debug ? `
---LATEST LENGTH: ${encodeLength(latestMessagesAndCurrentPrompt)}---` : ''}
[${messageFormattedDateTime(new Date())}] ${this.username}:${END_OF_PROMPT}${latestResponseText}`;
    }

    private async getRelevantMessages(user: User, openai: OpenAIApi, orderWeight: number, vector: number[] | null):
        Promise<RelevancyResult[]> {
        try {
            const pinecone = await getPineconeClient();

            if (!vector || !pinecone) {
                return [];
            }

            if (this.nextEmbedCheck < new Date().getTime()) {
                await this.tryEmbedMany(user, openai);

                // 1 day
                this.nextEmbedCheck = new Date().getTime() + 86_400_000;
                await this.persist();
            }

            const scoreWeight = 1 - orderWeight;

            const queryParams: {
                topK: number;
                filter?: Filter<PineconeMetadata>;
                includeMetadata: true;
                includeValues?: boolean;
                vector: number[];
            } = {
                topK: 100,
                filter: {
                    threadId: this.threadId,
                },
                includeMetadata: true,
                vector,
            };

            const queryResult = await pinecone.query(queryParams);

            const timestamps = this.messageHistory
                .map(id => this.messageHistoryMap[id])
                .map(item => item.timestamp)
                .filter(ts => ts !== undefined) as number[];

            const sorted = queryResult.matches.map(match => {
                return {
                    index: binarySearchIndex(timestamps, match.metadata.timestamp),
                    score: match.score,
                };
            }).filter(match => match.index !== -1);

            // message id to max score map
            const wantedMessages: Record<number, number> = {};

            for (const match of sorted) {
                const index = match.index;

                const matchingMessage = this.messageHistoryMap[this.messageHistory[match.index]];

                wantedMessages[index] = Math.max(wantedMessages[index] ?? 0, match.score);

                if (matchingMessage.type === 'human') {
                    if (this.messageHistory.length > index + 1) {
                        wantedMessages[index + 1] = Math.max(wantedMessages[index + 1] ?? 0, match.score);
                    }
                } else {
                    if (index > 0) {
                        wantedMessages[index - 1] = Math.max(wantedMessages[index - 1] ?? 0, match.score);
                    }
                }
            }


            const entries = Object
                .entries(wantedMessages) as any as [index: number, score: number][];

            return entries.map(([index, score]): RelevancyResult => {
                const matchingMessage = this.messageHistoryMap[this.messageHistory[index]];

                const orderRanking = (index / this.messageHistory.length);

                const weighted = score * scoreWeight + orderWeight * orderRanking;

                const relevancyMatch: RelevancyMatch = {
                    index,
                    score,
                    weighted,
                    orderRanking,
                };

                return {
                    match: relevancyMatch,
                    message: matchingMessage,
                }
            });

        } catch (e) {
            logMessage('cannot get relevant messages', e);

            return [];
        }
    }

    public sendReply(channel: TextBasedChannel, message: string, messageToReplyTo?: Message<boolean>) {
        return new MultiMessage(channel, undefined, messageToReplyTo).update(message, true);
    }

    private async getDebugName(user: User) {
        return this.isDirectMessage ? user.username : await getGuildName(this.guildId);
    }

    static async initialiseAll() {
        const results = await db.find({
            key: {$regex: /^THREAD-/},
            $and: [
                {
                    "value.version": {
                        $in: [2, ChatGPTConversation.latestVersion],
                    },
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
                                // check last hour. if we crash for longer than an hour, ignore
                                $gt: new Date().getTime() - 3600000,
                            }
                        },
                        {
                            "value.lastUpdated": {$exists: false}
                        }
                    ]
                }
            ],
        }).toArray();

        logMessage(`Found ${results.length} number of version 2 threads to check.`)

        await Promise.all(results.map(async result => {
            const fromDb = result.value as ChatGPTConversation;
            const info = await this.handleRetrievalFromDB(fromDb);

            if (info != null) {
                try {
                    await info.initialise();
                } catch (e) {
                    logMessage('Failed to initialise info with thread id ', info.threadId, e);
                }
            }
        }));

        logMessage('Initialisation complete.');
    }
}

