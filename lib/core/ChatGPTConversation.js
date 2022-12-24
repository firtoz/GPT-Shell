"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatGPTConversation = exports.messageToPromptPart = void 0;
const db_1 = require("../database/db");
const MultiMessage_1 = require("../shared/MultiMessage");
const logMessage_1 = require("../utils/logMessage");
const GetEnv_1 = require("../utils/GetEnv");
const GetMissingAPIKeyResponse_1 = require("../utils/GetMissingAPIKeyResponse");
const ModelInfo_1 = require("./ModelInfo");
const GetOpenAIKeyForId_1 = require("./GetOpenAIKeyForId");
const TrySendingMessage_1 = require("./TrySendingMessage");
const discordClient_1 = require("../discord/discordClient");
const BaseConversation_1 = require("./BaseConversation");
const GetOriginalPrompt_1 = require("./GetOriginalPrompt");
const EncodeLength_1 = require("./EncodeLength");
const constants_1 = require("./constants");
require("./compute-cosine-similarity");
const GetLastMessagesUntilMaxTokens_1 = require("./GetLastMessagesUntilMaxTokens");
function sanitiseStringForRegex(input) {
    return input.replace(/[\[\]\$\.\^\{\}\(\)\*\+\?\\\|]/g, (match) => '\\' + match);
}
// uses a simple dot product
function similarity(vec1, vec2) {
    // Check that the vectors are the same length
    if (vec1.length !== vec2.length) {
        throw new Error('Vectors must be of the same length');
    }
    // Initialize the result
    let result = 0;
    // Calculate the dot product
    for (let i = 0; i < vec1.length; i++) {
        result += vec1[i] * vec2[i];
    }
    // Return the result
    return result;
}
const OPENAI_API_KEY = (0, GetEnv_1.getEnv)('OPENAI_API_KEY');
const MAIN_SERVER_ID = (0, GetEnv_1.getEnv)('MAIN_SERVER_ID');
if (!OPENAI_API_KEY) {
    throw new Error('Need OPENAI_API_KEY env variable.');
}
if (!MAIN_SERVER_ID) {
    throw new Error('Need MAIN_SERVER_ID env variable.');
}
const messageToPromptPart = (item) => {
    if (item.type === "human") {
        return `(${item.userId}|${item.username}):${item.content}`;
    }
    return `${item.username}:${item.content}`;
};
exports.messageToPromptPart = messageToPromptPart;
async function createHumanMessage(openai, user, message, useEmbedding) {
    const embedding = useEmbedding ? await openai.createEmbedding({
        user: user.id,
        input: message,
        model: 'text-embedding-ada-002',
    }) : null;
    const newMessageItem = {
        content: message,
        embedding: embedding != null ? embedding.data.data : null,
        numTokens: 0,
        type: 'human',
        username: user.username,
        userId: user.id,
        timestamp: new Date().getTime(),
    };
    newMessageItem.numTokens = (0, EncodeLength_1.encodeLength)((0, exports.messageToPromptPart)(newMessageItem));
    return newMessageItem;
}
async function createResponseMessage(openai, username, user, responseMessage, makeEmbeddings) {
    const embedding = makeEmbeddings ? await openai.createEmbedding({
        user: user.id,
        input: responseMessage,
        model: 'text-embedding-ada-002',
    }) : null;
    const newMessageItem = {
        content: responseMessage,
        embedding: embedding ? embedding.data.data : null,
        numTokens: 0,
        type: 'response',
        username: username,
        timestamp: new Date().getTime(),
    };
    newMessageItem.numTokens = (0, EncodeLength_1.encodeLength)((0, exports.messageToPromptPart)(newMessageItem));
    return newMessageItem;
}
class ChatGPTConversation extends BaseConversation_1.BaseConversation {
    username;
    model;
    static latestVersion = 2;
    messageHistory = [];
    version = ChatGPTConversation.latestVersion;
    makeEmbeddings = false;
    constructor(threadId, creatorId, guildId, username, model) {
        super(threadId, creatorId, guildId);
        this.username = username;
        this.model = model;
    }
    static async handleRetrievalFromDB(fromDb) {
        const result = new ChatGPTConversation(fromDb.threadId, fromDb.creatorId, fromDb.guildId, fromDb.username, fromDb.model);
        Object.assign(result, fromDb);
        return result;
    }
    async SendPromptToGPTChat(openai, user, message, onProgress) {
        const initialPrompt = (0, GetOriginalPrompt_1.getOriginalPrompt)(this.username);
        const numInitialPromptTokens = (0, EncodeLength_1.encodeLength)(initialPrompt);
        const newMessageItem = await createHumanMessage(openai, user, message, this.makeEmbeddings);
        this.messageHistory.push(newMessageItem);
        const modelInfo = ModelInfo_1.ModelInfo[this.model];
        let finished = false;
        let completeResponseText = '';
        while (!finished) {
            let response;
            try {
                const maxTokens = modelInfo.MAX_TOKENS_PER_RESPONSE;
                const currentResponseTokens = (0, EncodeLength_1.encodeLength)(completeResponseText);
                const messages = (0, GetLastMessagesUntilMaxTokens_1.getLastMessagesUntilMaxTokens)(this.messageHistory, modelInfo.MAX_ALLOWED_TOKENS - (numInitialPromptTokens + currentResponseTokens));
                const prompt = `${initialPrompt}
${messages.map(exports.messageToPromptPart).join('\n')}${constants_1.END_OF_PROMPT}
${this.username}:${completeResponseText}`;
                const newMessageItemEmbedding = newMessageItem.embedding;
                if (this.makeEmbeddings && newMessageItemEmbedding != null) {
                    const start = performance.now();
                    const embeddingWeight = 0.8;
                    const updateWeight = 1 - embeddingWeight;
                    function calculateUpdateScore(lastUpdate) {
                        const currentTime = new Date().getTime();
                        const secondsSinceLastUpdate = (currentTime - lastUpdate) / 1000;
                        const minutesSinceLastUpdate = secondsSinceLastUpdate / 60;
                        const hoursSinceLastUpdate = minutesSinceLastUpdate / 60;
                        const score = 1 / (1 + hoursSinceLastUpdate);
                        return score;
                    }
                    const rawSimilarities = this.messageHistory
                        .map((item, index) => {
                        if (item !== newMessageItem && item.embedding && item.embedding.length > 0) {
                            const similarityValue = similarity(newMessageItemEmbedding[0].embedding, item.embedding[0].embedding);
                            const updateScore = 1 / (this.messageHistory.length - index);
                            return {
                                item,
                                similarity: similarityValue,
                                updateScore: updateScore,
                                weighted: embeddingWeight * similarityValue + updateWeight * updateScore,
                            };
                        }
                        else {
                            return {
                                item,
                                similarity: 0,
                                weighted: 0,
                                updateScore: 0,
                            };
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
                    (0, logMessage_1.logMessage)(`Prompt is using ${messages.length} messages out of ${this.messageHistory.length} for ${(0, EncodeLength_1.encodeLength)(prompt)} tokens.`);
                    (0, logMessage_1.logMessage)(`Similarity top 10 - took ${((end - start) / 1000).toFixed(2)}s to compute:
${similarities.map(sim => {
                        return `- ${sim.similarity}: ${sim.item.content}`;
                    }).join('\n')}`);
                    (0, logMessage_1.logMessage)(`Weighted top 10 - took ${((end - start) / 1000).toFixed(2)}s to compute:
${weightedSims.map(sim => {
                        return `- ${sim.weighted} (${sim.updateScore}): ${sim.item.content}`;
                    }).join('\n')}`);
                }
                response = await openai.createCompletion({
                    model: this.model,
                    prompt,
                    temperature: 0.8,
                    max_tokens: maxTokens,
                    top_p: 0.9,
                    frequency_penalty: 0,
                    presence_penalty: 0,
                });
            }
            catch (e) {
                if (e.isAxiosError) {
                    response = e.response;
                }
                else {
                    (0, logMessage_1.logMessage)('Unhandled error:', e);
                    finished = true;
                }
            }
            if (!response) {
                onProgress('[[Could not get a response from OpenAI :( Perhaps their servers are down?]]', true);
                finished = true;
                break;
            }
            if (response.status !== 200) {
                const data = response.data;
                if (data.error?.type === 'insufficient_quota') {
                    onProgress('[[Whoops, ran out of tokens :( Contact your OpenAI account holder please.]]', true);
                }
                else if (data.error?.message) {
                    onProgress(`[[Error from OpenAI servers: "${data.error.message}"]]`, true);
                }
                else {
                    onProgress('[[Unknown error from OpenAI servers. Please ping the bot owner for help.]]', true);
                }
                (0, logMessage_1.logMessage)('Bad response', response.data);
                finished = true;
                break;
            }
            else {
                const choices = response.data.choices;
                if (choices.length !== 1) {
                    (0, logMessage_1.logMessage)('Not enough choices?!');
                    finished = true;
                    return null;
                }
                const choice = choices[0];
                const text = choice.text;
                completeResponseText += text;
                if (text == undefined) {
                    (0, logMessage_1.logMessage)('No text?!');
                    finished = true;
                    return null;
                }
                if (choice.finish_reason === 'stop') {
                    finished = true;
                    const responseMessage = await createResponseMessage(openai, this.username, user, completeResponseText, this.makeEmbeddings);
                    this.messageHistory.push(responseMessage);
                    (0, logMessage_1.logMessage)(`RESPONSE: ${await this.getLinkableId()} ${completeResponseText}`);
                    await this.persist();
                    if (onProgress) {
                        onProgress(completeResponseText, true);
                    }
                    return completeResponseText;
                }
                else {
                    if (onProgress) {
                        onProgress(completeResponseText, false);
                    }
                    finished = false;
                }
            }
        }
        return null;
    }
    async handlePrompt(user, channel, inputValue, messageToReplyTo) {
        let openai;
        (0, logMessage_1.logMessage)(`PROMPT: [${user.username}] in ${await this.getLinkableId()}: ${inputValue}`);
        if (this.isDirectMessage) {
            openai = await (0, GetOpenAIKeyForId_1.getOpenAIKeyForId)(user.id);
        }
        else {
            openai = await (0, GetOpenAIKeyForId_1.getOpenAIKeyForId)(this.guildId);
            if (!openai) {
                // fallback to user's key...
                openai = await (0, GetOpenAIKeyForId_1.getOpenAIKeyForId)(user.id);
            }
        }
        if (!openai) {
            (0, logMessage_1.logMessage)(`No api key for [${(await this.getDebugName(user))}].`);
            const response = await (0, GetMissingAPIKeyResponse_1.getMissingAPIKeyResponse)(this.isDirectMessage);
            const MAIN_SERVER_INVITE = (0, GetEnv_1.getEnv)('MAIN_SERVER_INVITE');
            if (MAIN_SERVER_INVITE) {
                response.content += '\n' + MAIN_SERVER_INVITE;
            }
            await (0, TrySendingMessage_1.trySendingMessage)(channel, response, messageToReplyTo);
            return;
        }
        if (inputValue === '<DEBUG>') {
            const { lastUpdated } = this;
            const totalTokens = this.messageHistory.reduce((sum, item) => sum + item.numTokens, 0);
            const numMessages = this.messageHistory.length;
            const debugInfo = { lastUpdated, numMessages, totalTokens };
            const debugMessage = `Debug: 
\`\`\`json
${JSON.stringify(debugInfo, null, '  ')}
\`\`\``;
            await (0, TrySendingMessage_1.trySendingMessage)(channel, { content: debugMessage }, messageToReplyTo);
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
            await (0, TrySendingMessage_1.trySendingMessage)(channel, {
                content: `Deleted: \n${deleted.map(item => (0, exports.messageToPromptPart)(item)).join('\n')}`,
            });
            return;
        }
        const historyPrefix = '<HISTORY>';
        if (inputValue.startsWith(historyPrefix)) {
            const historyConfig = await db_1.db.get(`HISTORY-CONFIG-${user.id}`);
            if (!historyConfig) {
                await new MultiMessage_1.MultiMessage(channel, undefined, messageToReplyTo)
                    .update('Please ping the bot owner to allow you to use the <HISTORY> command.', true);
                return;
            }
            let rest = inputValue.slice(historyPrefix.length);
            let toShow = 1;
            const param = parseInt(rest);
            if (!isNaN(param)) {
                toShow = Math.min(historyConfig.maxAllowed, param);
            }
            const history = this.messageHistory.slice(this.messageHistory.length - toShow);
            const response = `History: \n${history.map(item => (0, exports.messageToPromptPart)(item)).join('\n')}`;
            await new MultiMessage_1.MultiMessage(channel, undefined, messageToReplyTo).update(response, true);
            return;
        }
        const queryPrefix = '<QUERY>';
        if (this.makeEmbeddings && inputValue.startsWith(queryPrefix)) {
            await channel.sendTyping();
            let rest = inputValue.slice(queryPrefix.length);
            const firstCommaIndex = rest.indexOf(',');
            if (firstCommaIndex == -1) {
                await (0, TrySendingMessage_1.trySendingMessage)(channel, {
                    content: `<QUERY> [time-weight (from 0 to 1)], PROMPT MESSAGE`,
                });
                return;
            }
            const firstParam = rest.slice(0, firstCommaIndex).trim();
            const restPrompt = rest.slice(firstCommaIndex + 1).trimStart();
            const weight = parseFloat(firstParam);
            if (isNaN(weight) || weight < 0 || weight > 1) {
                await (0, TrySendingMessage_1.trySendingMessage)(channel, {
                    content: `<QUERY> [time-weight (from 0 to 1)], PROMPT MESSAGE\nERROR: time-weight value is not a number between 0 and 1!`,
                });
                return;
            }
            function calculateUpdateScore(lastUpdate) {
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
                .map((item, index) => {
                const updateScore = 1 / (this.messageHistory.length - index);
                if (item.embedding && item.embedding.length > 0) {
                    const similarityValue = similarity(embedding[0].embedding, item.embedding[0].embedding);
                    return {
                        item,
                        similarity: similarityValue,
                        updateScore: updateScore,
                        weighted: embeddingWeight * similarityValue + updateWeight * updateScore,
                    };
                }
                return {
                    item,
                    similarity: 0,
                    weighted: 0,
                    updateScore: 0,
                };
            });
            const weightedSims = rawSimilarities
                .sort((a, b) => b.weighted - a.weighted)
                .slice(0, 20);
            const response = `
QUERY: [${weight}, ${restPrompt}]            
Weighted top 20:
${weightedSims.map(sim => {
                return `- ${sim.weighted} (${sim.updateScore}): ${sim.item.content}`;
            }).join('\n')}`;
            await new MultiMessage_1.MultiMessage(channel, undefined, messageToReplyTo).update(response, true);
            return;
        }
        await channel.sendTyping();
        const multi = new MultiMessage_1.MultiMessage(channel, undefined, messageToReplyTo);
        if (messageToReplyTo) {
            this.lastDiscordMessageId = messageToReplyTo.id;
        }
        const multiPromise = this.SendPromptToGPTChat(openai, user, inputValue, (result, finished) => {
            multi.update(result, finished);
            if (finished && multi.messageList.length > 0) {
                this.lastDiscordMessageId = multi.messageList[multi.messageList.length - 1].message.id;
                this.persist();
            }
        });
        let promiseComplete = false;
        const intervalId = setInterval(() => {
            if (promiseComplete) {
                clearInterval(intervalId);
                return;
            }
            // Do something every 10 seconds
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
    async getDebugName(user) {
        return this.isDirectMessage ? user.username : await (0, discordClient_1.getGuildName)(this.guildId);
    }
    static async initialiseAll() {
        const results = await db_1.db.find({
            key: { $regex: /^THREAD-/ },
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
                            "value.deleted": { $exists: false }
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
                            "value.lastUpdated": { $exists: false }
                        }
                    ]
                }
            ],
        }).toArray();
        (0, logMessage_1.logMessage)(`Found ${results.length} number of version 2 threads to check.`);
        await Promise.all(results.map(async (result) => {
            const fromDb = result.value;
            const info = await this.handleRetrievalFromDB(fromDb);
            if (info != null) {
                try {
                    await info.initialise();
                }
                catch (e) {
                    (0, logMessage_1.logMessage)('Failed to initialise info with thread is ', info.threadId, e);
                }
            }
        }));
        (0, logMessage_1.logMessage)('Initialisation complete.');
    }
    static async upgrade(fromDb) {
        (0, logMessage_1.logMessage)(`trying to convert ${await BaseConversation_1.BaseConversation.GetLinkableId(fromDb)}(${fromDb.threadId})!`);
        try {
            const promptSplit = fromDb.allHistory.split(constants_1.END_OF_PROMPT);
            let promptStart = 0;
            for (let i = 0; i < promptSplit.length; ++i) {
                const promptPart = promptSplit[i];
                if (promptPart.trim().endsWith('Generate only one response per prompt.')) {
                    promptStart = i + 1;
                    break;
                }
            }
            const actualConversation = promptSplit.slice(promptStart);
            const history = [];
            for (let string of actualConversation) {
                // ignore empty strings
                if (string.trim().length === 0) {
                    continue;
                }
                const originalRegex = /\s*(GPT-Shell:\s*?(?<response>(.|\n)*?))?\s*?((\n\((?<username>.*?)\|(?<userId>[0-9]+)\): (?<prompt>(.|\n)*))|$)/;
                const newRegex = new RegExp(originalRegex.source.replace('GPT-Shell', sanitiseStringForRegex(fromDb.username)));
                const match = string
                    .match(newRegex);
                if (!match || !match.groups) {
                    throw new Error('No match!');
                }
                const { prompt, response, userId, username } = match.groups;
                if (!response && !prompt) {
                    (0, logMessage_1.logMessage)({ string, newRegex: newRegex.source });
                    throw new Error('Something wrong with the string, no prompt or response');
                }
                if (response) {
                    history.push({
                        type: 'response',
                        content: response.trimStart(),
                        numTokens: (0, EncodeLength_1.encodeLength)(response),
                        embedding: null,
                        timestamp: undefined,
                        username: fromDb.username,
                    });
                }
                if (prompt) {
                    history.push({
                        type: 'human',
                        username: username,
                        userId: userId,
                        content: prompt,
                        numTokens: (0, EncodeLength_1.encodeLength)(prompt),
                        embedding: null,
                        timestamp: undefined,
                    });
                }
            }
            const result = new ChatGPTConversation(fromDb.threadId, fromDb.creatorId, fromDb.guildId, fromDb.username, fromDb.model);
            result.messageHistory = history;
            result.makeEmbeddings = false;
            result.deleted = false;
            result.isDirectMessage = fromDb.isDirectMessage;
            result.lastDiscordMessageId = fromDb.lastDiscordMessageId;
            result.lastUpdated = fromDb.lastUpdated;
            (0, logMessage_1.logMessage)(`managed to convert ${await result.getLinkableId()}!`);
            return result;
        }
        catch (e) {
            const adminPingId = (0, GetEnv_1.getEnv)('ADMIN_PING_ID');
            (0, logMessage_1.logMessage)(`${adminPingId ? `<@${adminPingId}>` : ''}! Could not upgrade conversation... ${await BaseConversation_1.BaseConversation.GetLinkableId(fromDb)}`, e);
            return null;
        }
    }
}
exports.ChatGPTConversation = ChatGPTConversation;
//# sourceMappingURL=ChatGPTConversation.js.map