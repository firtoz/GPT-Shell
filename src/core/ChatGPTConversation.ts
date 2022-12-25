import {db} from "../database/db";
import {MultiMessage} from "../shared/MultiMessage";
import {EmbedType, Message, TextBasedChannel, User} from "discord.js";
import {logMessage, printArg} from "../utils/logMessage";
import {CreateCompletionResponse, CreateEmbeddingResponse, OpenAIApi} from 'openai';
import {AxiosResponse} from "axios";
import {getEnv} from "../utils/GetEnv";
import {getMissingAPIKeyResponse} from "../utils/GetMissingAPIKeyResponse";
import {ModelInfo, ModelName} from "./ModelInfo";
import {getOpenAIKeyForId} from "./GetOpenAIKeyForId";
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

import {Filter, PineconeClient, Vector} from 'pinecone-client';
import {v4} from "uuid";

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

// A type representing your metadata
type Metadata = {
    threadId: string;
    timestamp: number;
    id: string;
};

const PINECONE_API_KEY = getEnv('PINECONE_API_KEY');
const PINECONE_NAMESPACE = getEnv('PINECONE_NAMESPACE');
const PINECONE_BASE_URL = getEnv('PINECONE_BASE_URL');

if (!PINECONE_API_KEY) {
    throw new Error('No PINECONE_API_KEY!');
}

const pinecone = PINECONE_API_KEY && PINECONE_NAMESPACE && PINECONE_BASE_URL ? new PineconeClient<Metadata>({
    apiKey: PINECONE_API_KEY,
    baseUrl: PINECONE_BASE_URL,
    namespace: PINECONE_NAMESPACE,
}) : null;

type HistoryConfig = {
    maxAllowed: number;
}

function sanitiseStringForRegex(input: string) {
    return input.replace(/[\[\]\$\.\^\{\}\(\)\*\+\?\\\|]/g, (match) => '\\' + match);
}

const OPENAI_API_KEY = getEnv('OPENAI_API_KEY');
const MAIN_SERVER_ID = getEnv('MAIN_SERVER_ID');

if (!OPENAI_API_KEY) {
    throw new Error('Need OPENAI_API_KEY env variable.');
}
if (!MAIN_SERVER_ID) {
    throw new Error('Need MAIN_SERVER_ID env variable.');
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

async function createHumanMessage(openai: OpenAIApi, user: User, message: string, useEmbedding: boolean) {
    let embedding: AxiosResponse<CreateEmbeddingResponse> | null;
    if (useEmbedding) {
        embedding = await openai.createEmbedding({
            user: user.id,
            input: message,
            model: 'text-embedding-ada-002',
        }) as any as AxiosResponse<CreateEmbeddingResponse>;
    } else {
        embedding = null;
    }

    const newMessageItem: MessageHistoryItem = {
        id: v4(),
        content: message,
        embedding: embedding != null ? '' : null,
        numTokens: 0,
        type: 'human',
        username: user.username,
        userId: user.id,
        timestamp: new Date().getTime(),
    };

    newMessageItem.numTokens = encodeLength(messageToPromptPart(newMessageItem));

    return newMessageItem;
}

async function createResponseMessage(openai: OpenAIApi, username: string, user: User, responseMessage: string, makeEmbeddings: boolean) {
    const embedding = makeEmbeddings ? await openai.createEmbedding({
        user: user.id,
        input: responseMessage,
        model: 'text-embedding-ada-002',
    }) : null;

    const newMessageItem: MessageHistoryItem = {
        id: v4(),
        content: responseMessage,
        embedding: embedding ? '' : null,
        numTokens: 0,
        type: 'response',
        username: username,
        timestamp: new Date().getTime(),
    };

    newMessageItem.numTokens = encodeLength(messageToPromptPart(newMessageItem));

    return newMessageItem;
}


export class ChatGPTConversation extends BaseConversation {
    static latestVersion = 3;

    messageHistory: string[] = [];

    messageHistoryMap: Record<string, MessageHistoryItem> = {};

    public version = ChatGPTConversation.latestVersion;
    private makeEmbeddings: boolean = false;

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

    private async SendPromptToGPTChat(
        openai: OpenAIApi,
        user: User,
        message: string,
        onProgress: (result: string, finished: boolean) => void,
    ): Promise<string | null> {
        const initialPrompt = getOriginalPrompt(this.username);
        const numInitialPromptTokens = encodeLength(initialPrompt);
        const newMessageItem = await createHumanMessage(openai, user, message, this.makeEmbeddings);

        this.messageHistoryMap[newMessageItem.id] = newMessageItem;
        this.messageHistory.push(newMessageItem.id);

        const modelInfo = ModelInfo[this.model];


        let finished = false;
        let latestResponseText = '';

        while (!finished) {
            let response: AxiosResponse<CreateCompletionResponse> | undefined;

            try {
                const maxTokens = modelInfo.MAX_TOKENS_PER_RESPONSE;

                const currentResponseTokens = encodeLength(latestResponseText);

                const messages = getLastMessagesUntilMaxTokens(this.messageHistory.map(id => this.messageHistoryMap[id]),
                    modelInfo.MAX_ALLOWED_TOKENS - (numInitialPromptTokens + currentResponseTokens)
                );

                const prompt = `${initialPrompt}
${messages.map(messageToPromptPart).join('\n')}
[${messageFormattedDateTime(new Date())}] ${this.username}:${END_OF_PROMPT}${latestResponseText}`;

                // const newMessageItemEmbedding = newMessageItem.embedding;

                response = await openai.createCompletion({
                    model: this.model,
                    prompt,
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

                    const responseMessage = await createResponseMessage(openai, this.username, user, latestResponseText, this.makeEmbeddings);
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

        if (inputValue === '<EMBED>' && pinecone != null) {
            const withoutEmbedding = this.messageHistory
                .map(id => this.messageHistoryMap[id])
                .filter(item => !item.embedding || Array.isArray(item.embedding));

            let timestampsFixed = false;
            for (let i = 0; i < withoutEmbedding.length; i++) {
                let withoutEmbeddingElement = withoutEmbedding[i];
                if (!withoutEmbeddingElement.timestamp) {
                    withoutEmbeddingElement.timestamp = this.lastUpdated - 1000 * (withoutEmbedding.length - i);
                    timestampsFixed = true;
                }
            }

            await this.persist();

            const firstN = withoutEmbedding.slice(0, 100);

            if (firstN.length === 0) {
                await this.sendReply(channel, `No need to embed anything.`, messageToReplyTo);

                return;
            }

            await this.sendReply(channel, `Preparing to embed ${firstN.length} messages...`, messageToReplyTo);

            const embeddings = await openai.createEmbedding({
                user: user.id,
                input: firstN.map(item => item.content),
                model: 'text-embedding-ada-002',
            });

            await this.sendReply(channel, `Embeddings created for ${firstN.length} messages.`, messageToReplyTo);

            const vectors: Vector<Metadata>[] = firstN.map((item, index) => {
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
                await this.sendReply(channel, `Inserting to pinecone...`, messageToReplyTo);

                await pinecone.upsert({
                    vectors
                });

                for (let i = 0; i < firstN.length; i++) {
                    let item = firstN[i];
                    item.embedding = vectors[i].id;
                }

                await this.persist();

                await new MultiMessage(channel, undefined, messageToReplyTo)
                    .update(`upsert completed!`, true);
            } catch (e) {
                await new MultiMessage(channel, undefined, messageToReplyTo)
                    .update(`Error: ${printArg(e)}`, true);
            }

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

            const deleted = this.messageHistory.splice(this.messageHistory.length - toDelete);

            await trySendingMessage(channel, {
                content: `Deleted: \n${deleted.length} message(s).`,
            });

            await this.persist();

            return;
        }

        const promptPrefix = '<PROMPT>';
        if (inputValue.startsWith(promptPrefix)) {
            const initialPrompt = getOriginalPrompt(this.username);
            const numInitialPromptTokens = encodeLength(initialPrompt);

            const modelInfo = ModelInfo[this.model];

            const newMessageItem = await createHumanMessage(openai, user, inputValue.slice(promptPrefix.length), this.makeEmbeddings);
            const messages = getLastMessagesUntilMaxTokens(this.messageHistory
                    .map(id => this.messageHistoryMap[id])
                    .concat(newMessageItem),
                modelInfo.MAX_ALLOWED_TOKENS - (numInitialPromptTokens)
            );

            const fullPrompt = `${initialPrompt}
${messages.map(messageToPromptPart).join('\n')}
[${messageFormattedDateTime(new Date())}] ${this.username}:${END_OF_PROMPT}`;

            const prompt = `===PROMPT===
${fullPrompt}
===END PROMPT - TOKENS: ${encodeLength(fullPrompt)} ===`;

            await new MultiMessage(channel, undefined, messageToReplyTo).update(prompt, true);

            return;
        }

        const historyPrefix = '<HISTORY>';
        if (inputValue.startsWith(historyPrefix)) {
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
        if (inputValue.startsWith(queryPrefix) && pinecone != null) {
            let rest = inputValue.slice(queryPrefix.length);

            const firstCommaIndex = rest.indexOf(',');
            if (firstCommaIndex == -1) {
                await trySendingMessage(channel, {
                    content: `<QUERY> [time-weight (from 0 to 1)], PROMPT MESSAGE`,
                });

                return;
            }

            const firstParam = parseFloat(rest.slice(0, firstCommaIndex).trim());

            if (isNaN(firstParam) || firstParam < 0 || firstParam > 1) {
                await trySendingMessage(channel, {
                    content: `<QUERY> [time-weight (NUMBER from 0 to 1)], PROMPT MESSAGE`,
                });

                return;
            }

            const restPrompt = rest.slice(firstCommaIndex + 1).trimStart();

            const embedding = await openai.createEmbedding({
                user: user.id,
                input: restPrompt,
                model: 'text-embedding-ada-002',
            }) as any as AxiosResponse<CreateEmbeddingResponse>;

            const vector = embedding.data.data[0].embedding;

            const queryParams: {
                topK: number;
                filter?: Filter<Metadata>;
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

            const orderWeight = firstParam;
            const scoreWeight = 1 - orderWeight;

            const entries = Object
                .entries(wantedMessages) as any as [index: number, score: number][];

            const messages = entries.map(([index, score]) => {
                const matchingMessage = this.messageHistoryMap[this.messageHistory[index]];

                const orderRanking = (index / this.messageHistory.length);

                const weighted = score * scoreWeight + orderWeight * orderRanking;

                return {
                    match: {
                        index,
                        score,
                        weighted,
                        orderRanking,
                    },
                    message: matchingMessage,
                }
            });

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

        await channel.sendTyping();

        const multi = new MultiMessage(channel, undefined, messageToReplyTo);

        if (messageToReplyTo) {
            this.lastDiscordMessageId = messageToReplyTo.id
        }

        const multiPromise = this.SendPromptToGPTChat(
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
            result.makeEmbeddings = false;
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
