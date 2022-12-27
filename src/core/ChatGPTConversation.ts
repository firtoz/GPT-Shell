import {db} from "../database/db";
import {MultiMessage} from "../shared/MultiMessage";
import {EmbedType, Message, TextBasedChannel, User} from "discord.js";
import {logMessage, printArg} from "../utils/logMessage";
import {CreateCompletionResponse, CreateEmbeddingResponse, OpenAIApi} from 'openai';
import {AxiosResponse} from "axios";
import {getEnv} from "../utils/GetEnv";
import {getMissingAPIKeyResponse} from "../utils/GetMissingAPIKeyResponse";
import {ModelName} from "./ModelInfo";
import {getOpenAIForId} from "./GetOpenAIForId";
import {trySendingMessage} from "./TrySendingMessage";
import {getGuildName} from "../discord/discordClient";
import {BaseConversation} from "./BaseConversation";
import {getOriginalPrompt} from "./GetOriginalPrompt";
import {CompletionError} from "./CompletionError";
import {encodeLength} from "./EncodeLength";
import {END_OF_PROMPT} from "./constants";
import './compute-cosine-similarity';
import {ChatGPTConversationVersion0} from "./ChatGPTConversationVersion0";
import {getLastMessagesUntilMaxTokens} from "./GetLastMessagesUntilMaxTokens";
import {MessageHistoryItem} from "./MessageHistoryItem";

import {Filter, Vector} from 'pinecone-client';
import {v4} from "uuid";
import {PineconeMetadata} from "./PineconeMetadata";
import {getConfig, getConfigForId, ServerConfigType} from "./config";
import {getPineconeClient} from "./pinecone";

const adminPingId = getEnv('ADMIN_PING_ID');


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

// const PINECONE_API_KEY = getEnv('PINECONE_API_KEY');
// const PINECONE_NAMESPACE = getEnv('PINECONE_NAMESPACE');
// const PINECONE_BASE_URL = getEnv('PINECONE_BASE_URL');
//
// if (!PINECONE_API_KEY) {
//     throw new Error('No PINECONE_API_KEY!');
// }
//
// const pinecone = PINECONE_API_KEY && PINECONE_NAMESPACE && PINECONE_BASE_URL ? new PineconeClient<Metadata>({
//     apiKey: PINECONE_API_KEY,
//     baseUrl: PINECONE_BASE_URL,
//     namespace: PINECONE_NAMESPACE,
// }) : null;

type HistoryConfig = {
    maxAllowed: number;
}

function sanitiseStringForRegex(input: string) {
    // noinspection RegExpRedundantEscape
    return input.replace(/[\[\]\$\.\^\{\}\(\)\*\+\?\\\|]/g, (match) => '\\' + match);
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

export class ChatGPTConversation extends BaseConversation {
    static latestVersion = 3;

    messageHistory: string[] = [];

    messageHistoryMap: Record<string, MessageHistoryItem> = {};

    nextEmbedCheck: number = 0;

    public version = ChatGPTConversation.latestVersion;

    constructor(
        threadId: string,
        creatorId: string,
        guildId: string,
        private username: string,
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

    async createHumanMessage(openai: OpenAIApi, user: User, message: string) {
        const messageId = v4();
        const timestamp = new Date().getTime();

        const embeddingId = await this.tryCreateEmbeddingForMessage(openai, user, message, timestamp, messageId);

        const newMessageItem: MessageHistoryItem = {
            id: messageId,
            content: message,
            embedding: embeddingId,
            numTokens: 0,
            type: 'human',
            username: user.username,
            userId: user.id,
            timestamp: timestamp,
        };

        newMessageItem.numTokens = encodeLength(messageToPromptPart(newMessageItem));

        return newMessageItem;
    }

    async createResponseMessage(openai: OpenAIApi, botUsername: string, user: User, message: string) {
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
        config: ServerConfigType,
        openai: OpenAIApi,
        user: User,
        message: string,
        onProgress: (result: string, finished: boolean) => void,
    ): Promise<string | null> {

        // const config = await getConfig();

        const modelInfo = config.modelInfo[this.model];

        let finished = false;
        let latestResponseText = '';

        const relevancyResultsCache: RelevancyCheckCache = {
            searchPerformed: false,
            results: [],
        };

        while (!finished) {
            let response: AxiosResponse<CreateCompletionResponse> | undefined;

            try {
                const maxTokens = modelInfo.MAX_TOKENS_PER_RESPONSE;

                // const currentResponseTokens = encodeLength(latestResponseText);

                // const messages = getLastMessagesUntilMaxTokens(this.messageHistory.map(id => this.messageHistoryMap[id]),
                //     modelInfo.MAX_ALLOWED_TOKENS - (numInitialPromptTokens + currentResponseTokens)
                // );

//                 const prompt = `${initialPrompt}
// ${messages.map(messageToPromptPart).join('\n')}
// [${messageFormattedDateTime(new Date())}] ${this.username}:${END_OF_PROMPT}${latestResponseText}`;

                const fullPrompt = await this.getFullPrompt(config, openai, user, message, latestResponseText, relevancyResultsCache);

                // const newMessageItemEmbedding = newMessageItem.embedding;

                response = await openai.createCompletion({
                    model: this.model,
                    prompt: fullPrompt,
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
                    finished = true;

                    return null;
                }

                const choice = choices[0];

                const text = choice.text;

                latestResponseText += text;

                if (text == undefined) {
                    logMessage('No text?!');
                    finished = true;

                    return null;
                }

                if (choice.finish_reason === 'stop') {
                    finished = true;

                    const newMessageItem = await this.createHumanMessage(openai, user, message);

                    this.messageHistoryMap[newMessageItem.id] = newMessageItem;
                    this.messageHistory.push(newMessageItem.id);

                    const responseMessage = await this.createResponseMessage(openai, this.username, user, latestResponseText);
                    this.messageHistory.push(responseMessage.id);
                    this.messageHistoryMap[responseMessage.id] = responseMessage;

                    logMessage(`RESPONSE: ${await this.getLinkableId()} ${latestResponseText}`, 'usage', response.data.usage);

                    await this.persist();

                    if (onProgress) {
                        onProgress(latestResponseText, true);
                    }

                    return latestResponseText;
                } else {
                    if (onProgress) {
                        onProgress(latestResponseText, false);
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

        logMessage(`PROMPT: [${user.username}] in ${await this.getLinkableId()}: ${inputValue}`);

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


        if (inputValue === '<EMBED>' && user.id === adminPingId) {
            await this.tryEmbedMany(user, openai, channel, messageToReplyTo);
            return;
        }

        if (inputValue === '<DEBUG>') {
            const {lastUpdated} = this;
            const totalTokens = this.messageHistory.map(id => this.messageHistoryMap[id]).reduce((sum, item) => sum + item.numTokens, 0);
            const numMessages = this.messageHistory.length;
            const debugInfo = {lastUpdated, numMessages, totalTokens};
            const debugMessage = `Debug: 
\`\`\`json
${JSON.stringify(debugInfo, null, '  ')}
\`\`\``;

            await trySendingMessage(channel, {content: debugMessage}, messageToReplyTo);

            return;
        }

        const deletePrefix = '<DELETE>';
        if (inputValue.startsWith(deletePrefix)) {
            let rest = inputValue.slice(deletePrefix.length);

            let toDelete = 1;
            const param = parseInt(rest);
            if (!isNaN(param)) {
                toDelete = param;
            }

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

            await trySendingMessage(channel, {
                content: `Deleted: \n${deletedIndices.length} message(s).`,
            });

            await this.persist();

            return;
        }

        const promptPrefix = '<PROMPT>';
        if (inputValue.startsWith(promptPrefix) && user.id === adminPingId) {
            const input = inputValue.slice(promptPrefix.length);

            const fullPrompt = await this.getFullPrompt(serverConfig, openai, user, input, '', {
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
        if (inputValue.startsWith(historyPrefix) && user.id === adminPingId) {
            const historyConfig = await db.get<HistoryConfig>(`HISTORY-CONFIG-${user.id}`);

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
        if (inputValue.startsWith(queryPrefix) && user.id === adminPingId) {
            const pinecone = await getPineconeClient();
            if (pinecone != null) {
                await this.testQuery(inputValue, queryPrefix, channel, user, openai, messageToReplyTo);
                return;
            }

            return;
        }

        await channel.sendTyping();

        const multi = new MultiMessage(channel, undefined, messageToReplyTo);

        if (messageToReplyTo) {
            this.lastDiscordMessageId = messageToReplyTo.id;
        }

        const multiPromise = this.SendPromptToGPTChat(
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

        let promiseComplete = false;

        const intervalId = setInterval(() => {
            if (promiseComplete) {
                clearInterval(intervalId);
                return;
            }

            channel.sendTyping();
        }, 5000);

        // When the promise completes, set the variable to true
        // so that the interval stops
        multiPromise.finally(() => {
            promiseComplete = true;
        });

        await multiPromise;

        if (multi.messageList.length > 0) {
            this.lastDiscordMessageId = multi.messageList[multi.messageList.length - 1].message.id;
            await this.persist();
        }
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

        const messages = await this.getRelevantMessages(user, openai, input, orderWeight);

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
            return `- ${indexString} S:${scoreString} O:${orderString} W:${weightString} ${item.message.numTokens.toString().padStart(4, '0')}
${messageToPromptPart(item.message)}`;
        }).join('\n');

        await this.sendReply(channel, `Result:\n${resultString}`, messageToReplyTo);

        return;
    }

    private async getFullPrompt(
        config: ServerConfigType,
        openai: OpenAIApi,
        user: User,
        input: string,
        latestResponseText: string,
        relevancyCheckCache: RelevancyCheckCache,
        debug: boolean = false,
    ) {
        const initialPrompt = getOriginalPrompt(this.username);
        // const config = await getConfig();
        const modelInfo = config.modelInfo[this.model];

        const numInitialPromptTokens = encodeLength(initialPrompt);
        const currentResponseTokens = encodeLength(latestResponseText);

        const inputMessageItem = await this.createHumanMessage(openai, user, input);

        const inputTokens = encodeLength(messageToPromptPart(inputMessageItem));

        let availableTokens = modelInfo.MAX_ALLOWED_TOKENS - numInitialPromptTokens - currentResponseTokens - inputTokens;

        const allMessagesInHistory = this.messageHistory.map(id => this.messageHistoryMap[id]);
        const totalTokensFromHistory = allMessagesInHistory.reduce((sum, item) => sum + item.numTokens, 0);

        if (totalTokensFromHistory < availableTokens) {
            // use only messages, it's simpler

            return `${initialPrompt}${debug ? '\nDEBUG: ALL MESSAGES:' : ''}
${allMessagesInHistory.concat(inputMessageItem).map(messageToPromptPart).join('\n')}
[${messageFormattedDateTime(new Date())}] ${this.username}:${END_OF_PROMPT}`;
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

            const relevantMessages = await this.getRelevantMessages(user, openai, relevantMessageInput, 0.05);

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
            .reduce((sum, item) => sum + item.numTokens, 0);

        availableTokens -= usedTokensFromMessages;

        const includedRelevantMessages: RelevancyResult[] = [];
        for (const relevantMessage of unseenRelevantMessages) {
            if (relevantMessage.message.numTokens < availableTokens) {
                includedRelevantMessages.push(relevantMessage);
                availableTokens -= relevantMessage.message.numTokens;
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
            relevantSuffix = `---END RELEVANT - TOKENS: ${includedRelevantMessages.reduce((sum, item) => sum + item.message.numTokens, 0)} ---`;
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
[${messageFormattedDateTime(new Date())}] ${this.username}:${END_OF_PROMPT}`;
    }

    private async getRelevantMessages(user: User, openai: OpenAIApi, input: string, orderWeight: number):
        Promise<RelevancyResult[]> {
        const pinecone = await getPineconeClient();

        if (!pinecone) {
            return [];
        }

        if (this.nextEmbedCheck < new Date().getTime()) {
            await this.tryEmbedMany(user, openai);

            // 1 day
            this.nextEmbedCheck = new Date().getTime() + 86_400_000;
            await this.persist();
        }

        const scoreWeight = 1 - orderWeight;


        let embeddings: AxiosResponse<CreateEmbeddingResponse>;
        try {
            embeddings = await openai.createEmbedding({
                user: user.id,
                input: input,
                model: 'text-embedding-ada-002',
            }) as any as AxiosResponse<CreateEmbeddingResponse>;
        } catch (e) {
            logMessage(`${await this.getLinkableId()}: Cannot create embeddings`, e);

            return [];
        }

        const vector = embeddings.data.data[0].embedding;

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
    }

    private sendReply(channel: TextBasedChannel, message: string, messageToReplyTo?: Message<boolean>) {
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

        logMessage(`Found ${results.length} number of version 2 threads to check.`)

        await Promise.all(results.map(async result => {
            const fromDb = result.value as ChatGPTConversation;
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

    static async upgrade(fromDb: ChatGPTConversationVersion0): Promise<ChatGPTConversation | null> {
        logMessage(`trying to convert ${await BaseConversation.GetLinkableId(fromDb)}(${fromDb.threadId})!`);

        try {
            const promptSplit = fromDb.allHistory.split(END_OF_PROMPT);

            let promptStart = 0;
            for (let i = 0; i < promptSplit.length; ++i) {
                const promptPart = promptSplit[i];
                if (promptPart.trim().endsWith('Generate only one response per prompt.')) {
                    promptStart = i + 1;
                    break;
                }
            }

            const actualConversation = promptSplit.slice(promptStart);

            const history: MessageHistoryItem[] = [];

            for (let string of actualConversation) {
                // ignore empty strings
                if (string.trim().length === 0) {
                    continue;
                }

                const originalRegex = /\s*(GPT-Shell:\s*?(?<response>(.|\n)*?))?\s*?((\n\((?<username>.*?)\|(?<userId>[0-9]+)\): (?<prompt>(.|\n)*))|$)/;
                const newRegex = new RegExp(originalRegex.source.replace('GPT-Shell', sanitiseStringForRegex(fromDb.username)));
                const match = string
                    .match(newRegex)

                if (!match || !match.groups) {
                    throw new Error('No match!');
                }

                const {prompt, response, userId, username} = match.groups;

                if (!response && !prompt) {
                    logMessage({string, newRegex: newRegex.source});
                    throw new Error('Something wrong with the string, no prompt or response');
                }

                if (response) {
                    history.push({
                        id: v4(),
                        type: 'response',
                        content: response.trimStart(),
                        numTokens: encodeLength(response),
                        embedding: null,
                        timestamp: undefined,
                        username: fromDb.username,
                    });
                }

                if (prompt) {
                    history.push({
                        id: v4(),
                        type: 'human',
                        username: username,
                        userId: userId,
                        content: prompt,
                        numTokens: encodeLength(prompt),
                        embedding: null,
                        timestamp: undefined,
                    })
                }
            }

            const result: ChatGPTConversation = new ChatGPTConversation(
                fromDb.threadId,
                fromDb.creatorId,
                fromDb.guildId,
                fromDb.username,
                fromDb.model,
            );

            result.messageHistory = history.map(item => item.id);
            result.messageHistoryMap = history.reduce((map, item) => {
                map[item.id] = item;
                return map;
            }, {} as Record<string, MessageHistoryItem>);
            result.deleted = false;
            result.isDirectMessage = fromDb.isDirectMessage;
            result.lastDiscordMessageId = fromDb.lastDiscordMessageId;
            result.lastUpdated = fromDb.lastUpdated;

            logMessage(`managed to convert ${await result.getLinkableId()}!`);

            return result;
        } catch (e) {
            const adminPingId = getEnv('ADMIN_PING_ID')
            logMessage(`${adminPingId ? `<@${adminPingId}>` : ''}! Could not upgrade conversation... ${await BaseConversation.GetLinkableId(fromDb)}`, e);
            return null;
        }
    }
}
