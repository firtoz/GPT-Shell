import {db} from "../database/db";
import {MultiMessage} from "../shared/MultiMessage";
import {Collection, EmbedType, Message, TextBasedChannel, User} from "discord.js";
import {logMessage} from "../utils/logMessage";

import {CreateCompletionResponse, CreateEmbeddingResponseDataInner, OpenAIApi} from 'openai';
import {AxiosResponse} from "axios";
import {getEnv} from "../utils/GetEnv";
import {getMissingAPIKeyResponse} from "../utils/GetMissingAPIKeyResponse";
import {ModelInfo, ModelName} from "./ModelInfo";
import {getOpenAIKeyForId} from "./GetOpenAIKeyForId";
import {trySendingMessage} from "./TrySendingMessage";
import {discordClient, getGuildName} from "../discord/discordClient";
import {getWhimsicalResponse} from "../discord/listeners/ready/getWhimsicalResponse";
import {messageReceivedInThread} from "../discord/listeners/ready/message-handling/handleThread";
import {BaseConversation} from "./BaseConversation";
import {getOriginalPrompt} from "./GetOriginalPrompt";
import {CompletionError} from "./CompletionError";
import {encodeLength} from "./EncodeLength";
import {END_OF_PROMPT} from "./constants";
import './compute-cosine-similarity';

import similarity from "compute-cosine-similarity";

const OPENAI_API_KEY = getEnv('OPENAI_API_KEY');
const MAIN_SERVER_ID = getEnv('MAIN_SERVER_ID');

if (!OPENAI_API_KEY) {
    throw new Error('Need OPENAI_API_KEY env variable.');
}
if (!MAIN_SERVER_ID) {
    throw new Error('Need MAIN_SERVER_ID env variable.');
}


type MessageHistoryItem = ({
    type: 'human';
    userId: string;
} | {
    type: 'response';
}) & {
    timestamp: number;
    username: string;
    content: string;
    numTokens: number;
    embedding: CreateEmbeddingResponseDataInner[];
};

export const messageToPromptPart = (item: MessageHistoryItem): string => {
    if (item.type === "human") {
        return `(${item.userId}|${item.username}):${item.content}`;
    }

    return `${item.username}:${item.content}`;
}

export const getLastMessagesUntilMaxTokens = <T extends (Partial<MessageHistoryItem> & Pick<MessageHistoryItem, 'numTokens'>)>(
    messageHistory: T[],
    maxTokens: number,
): T[] => {
    let sum = 0;

    if (messageHistory.length < 1) {
        return messageHistory;
    }

    let i = messageHistory.length - 1;
    if (messageHistory[i].numTokens > maxTokens) {
        return [];
    }

    while (i >= 0) {
        let current = messageHistory[i];
        if (sum + current.numTokens <= maxTokens) {
            sum += current.numTokens;
        } else {
            break;
        }
        i--;
    }

    return messageHistory.slice(i + 1);
}

async function createHumanMessage(openai: OpenAIApi, user: User, message: string) {
    const embedding = await openai.createEmbedding({
        user: user.id,
        input: message,
        model: 'text-embedding-ada-002',
    });

    const newMessageItem: MessageHistoryItem = {
        content: message,
        embedding: embedding.data.data,
        numTokens: 0,
        type: 'human',
        username: user.username,
        userId: user.id,
        timestamp: new Date().getTime(),
    };

    newMessageItem.numTokens = encodeLength(messageToPromptPart(newMessageItem));

    return newMessageItem;
}

async function createResponseMessage(openai: OpenAIApi, username: string, user: User, responseMessage: string) {
    const embedding = await openai.createEmbedding({
        user: user.id,
        input: responseMessage,
        model: 'text-embedding-ada-002',
    });

    const newMessageItem: MessageHistoryItem = {
        content: responseMessage,
        embedding: embedding.data.data,
        numTokens: 0,
        type: 'response',
        username: username,
        timestamp: new Date().getTime(),
    };

    newMessageItem.numTokens = encodeLength(messageToPromptPart(newMessageItem));

    return newMessageItem;
}


export class ChatGPTConversation extends BaseConversation {
    static latestVersion = 2;

    deleted: boolean = false;

    messageHistory: MessageHistoryItem[] = [];

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
        const result = new ChatGPTConversation(
            fromDb.threadId,
            fromDb.creatorId,
            fromDb.guildId,
            fromDb.username,
            fromDb.model,
        );

        Object.assign(result, fromDb);

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
        const newMessageItem = await createHumanMessage(openai, user, message);

        this.messageHistory.push(newMessageItem);

        const modelInfo = ModelInfo[this.model];


        let finished = false;
        let completeResponseText = '';

        while (!finished) {
            let response: AxiosResponse<CreateCompletionResponse> | undefined;

            try {
                const maxTokens = modelInfo.MAX_TOKENS_PER_RESPONSE;

                const currentResponseTokens = encodeLength(completeResponseText);

                const messages = getLastMessagesUntilMaxTokens(this.messageHistory,
                    modelInfo.MAX_ALLOWED_TOKENS - (numInitialPromptTokens + currentResponseTokens)
                );

                const prompt = `${initialPrompt}
${messages.map(messageToPromptPart).join('\n')}${END_OF_PROMPT}
${this.username}:${completeResponseText}`;


                const start = performance.now();

                const embeddingWeight = 0.8;
                const updateWeight = 1 - embeddingWeight;

                function calculateUpdateScore(lastUpdate: number) {
                    const currentTime = new Date().getTime();
                    const secondsSinceLastUpdate = (currentTime - lastUpdate) / 1000;
                    const minutesSinceLastUpdate = secondsSinceLastUpdate / 60;
                    const hoursSinceLastUpdate = minutesSinceLastUpdate / 60;
                    const score = 1 / (1 + hoursSinceLastUpdate);
                    return score;
                }

                const rawSimilarities = this.messageHistory
                    .filter(item => item !== newMessageItem && item.embedding.length > 0)
                    .map(item => {
                        const similarityValue = similarity(newMessageItem.embedding[0].embedding, item.embedding[0].embedding);
                        const updateScore = calculateUpdateScore(item.timestamp)

                        return {
                            item,
                            similarity: similarityValue,
                            updateScore: updateScore,
                            weighted: embeddingWeight * similarityValue + updateWeight * updateScore,
                        }
                    });

                const similarities = rawSimilarities
                    .sort((a, b) => b.similarity - a.similarity)
                    .slice(0, 10);

                const weightedSims = rawSimilarities
                    .sort((a, b) => b.weighted - a.weighted)
                    .slice(0, 10);

                const end = performance.now();

                // logMessage(`Prompt:
// ${prompt.split('\n').map(item => `> ${item}`).join('\n')}`)

                logMessage(`Prompt is using ${messages.length} messages out of ${this.messageHistory.length} for ${encodeLength(prompt)} tokens.`);

                logMessage(`Similarity top 10 - took ${((end - start) / 1000).toFixed(2)}s to compute:
${similarities.map(sim => {
                    return `- ${sim.similarity}: ${sim.item.content}`;
                }).join('\n')}`);

                logMessage(`Weighted top 10 - took ${((end - start) / 1000).toFixed(2)}s to compute:
${weightedSims.map(sim => {
                    return `- ${sim.weighted} (${sim.updateScore}): ${sim.item.content}`;
                }).join('\n')}`);

                response = await openai.createCompletion({
                    model: this.model,
                    prompt,
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

                logMessage(`Response:${text}`)

                completeResponseText += text;

                if (text == undefined) {
                    logMessage('No text?!');
                    finished = true;

                    return null;
                }

                if (choice.finish_reason === 'stop') {
                    finished = true;

                    const responseMessage = await createResponseMessage(openai, this.username, user, completeResponseText);
                    this.messageHistory.push(responseMessage);

                    logMessage(`<#${this.threadId}> response: ${completeResponseText}`);

                    await this.persist();

                    if (onProgress) {
                        onProgress(completeResponseText, true);
                    }

                    return completeResponseText;
                } else {
                    if (onProgress) {
                        onProgress(completeResponseText, false);
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
            const totalTokens = this.messageHistory.reduce((sum, item) => sum + item.numTokens, 0);
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
                content: `Deleted: \n${deleted.map(item => messageToPromptPart(item)).join('\n')}`,
            });

            return;
        }

        const historyPrefix = '<HISTORY>';
        if (inputValue.startsWith(historyPrefix)) {
            let rest = inputValue.slice(historyPrefix.length);

            let toShow = 1;
            const param = parseInt(rest);
            if (!isNaN(param)) {
                toShow = param;
            }

            const history = this.messageHistory.slice(this.messageHistory.length - toShow);

            await trySendingMessage(channel, {
                content: `History: \n${history.map(item => messageToPromptPart(item)).join('\n')}`,
            });

            return;
        }

        const queryPrefix = '<QUERY>';
        if (inputValue.startsWith(queryPrefix)) {
            await channel.sendTyping();

            let rest = inputValue.slice(queryPrefix.length);

            const firstCommaIndex = rest.indexOf(',');
            if (firstCommaIndex == -1) {
                await trySendingMessage(channel, {
                    content: `<QUERY> [time-weight (from 0 to 1)], PROMPT MESSAGE`,
                });

                return;
            }

            const firstParam = rest.slice(0, firstCommaIndex).trim();
            const restPrompt = rest.slice(firstCommaIndex + 1).trimStart();

            const weight = parseFloat(firstParam);
            if (isNaN(weight) || weight < 0 || weight > 1) {
                await trySendingMessage(channel, {
                    content: `<QUERY> [time-weight (from 0 to 1)], PROMPT MESSAGE\nERROR: time-weight value is not a number between 0 and 1!`,
                });
                return;
            }

            function calculateUpdateScore(lastUpdate: number) {
                const currentTime = new Date().getTime();
                const secondsSinceLastUpdate = (currentTime - lastUpdate) / 1000;
                const minutesSinceLastUpdate = secondsSinceLastUpdate / 60;
                const hoursSinceLastUpdate = minutesSinceLastUpdate / 60;
                const score = 1 / (1 + hoursSinceLastUpdate);
                return score;
            }

            const embeddingResponse = await openai.createEmbedding({
                user: user.id,
                input: restPrompt,
                model: 'text-embedding-ada-002',
            });

            const embedding = embeddingResponse.data.data;

            const updateWeight = weight;
            const embeddingWeight = 1 - updateWeight;

            const rawSimilarities = this.messageHistory
                .filter(item => item.embedding.length > 0)
                .map(item => {
                    const similarityValue = similarity(embedding[0].embedding, item.embedding[0].embedding);
                    const updateScore = calculateUpdateScore(item.timestamp)

                    return {
                        item,
                        similarity: similarityValue,
                        updateScore: updateScore,
                        weighted: embeddingWeight * similarityValue + updateWeight * updateScore,
                    }
                });

            const weightedSims = rawSimilarities
                .sort((a, b) => b.weighted - a.weighted)
                .slice(0, 10);

            const response = `
QUERY: [${weight}, ${restPrompt}]            
Weighted top 10:
${weightedSims.map(sim => {
                return `- ${sim.weighted} (${sim.updateScore}): ${sim.item.content}`;
            }).join('\n')}`;

            await new MultiMessage(channel, undefined, messageToReplyTo).update(response, true);

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
                    "value.version": ChatGPTConversation.latestVersion,
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
