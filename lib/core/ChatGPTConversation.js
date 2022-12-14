"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatGPTConversation = void 0;
const db_1 = require("../database/db");
const MultiMessage_1 = require("../shared/MultiMessage");
const logMessage_1 = require("../utils/logMessage");
// @ts-ignore
const gpt_3_encoder_1 = require("gpt-3-encoder");
const openai_1 = require("openai");
const GetEnv_1 = require("../utils/GetEnv");
const GetMissingAPIKeyResponse_1 = require("../utils/GetMissingAPIKeyResponse");
const ModelInfo_1 = require("./ModelInfo");
const GetOriginalPrompt_1 = require("./GetOriginalPrompt");
const constants_1 = require("./constants");
const GetOpenAIKeyForId_1 = require("./GetOpenAIKeyForId");
const TrySendingMessage_1 = require("./TrySendingMessage");
const cache = {};
const THREAD_PREFIX = `THREAD-`;
const OPENAI_API_KEY = (0, GetEnv_1.getEnv)('OPENAI_API_KEY');
const MAIN_SERVER_ID = (0, GetEnv_1.getEnv)('MAIN_SERVER_ID');
if (!OPENAI_API_KEY) {
    throw new Error('Need OPENAI_API_KEY env variable.');
}
if (!MAIN_SERVER_ID) {
    throw new Error('Need MAIN_SERVER_ID env variable.');
}
GetOpenAIKeyForId_1.OpenAICache[MAIN_SERVER_ID] = new openai_1.OpenAIApi(new openai_1.Configuration({
    apiKey: OPENAI_API_KEY,
}));
class ChatGPTConversation {
    threadId;
    creatorId;
    guildId;
    username;
    model;
    lastUpdated = 0;
    lastDiscordMessageId = null;
    deleted = false;
    allHistory = '';
    numPrompts = 0;
    currentHistory = '';
    isDirectMessage = false;
    constructor(threadId, creatorId, guildId, username, model) {
        this.threadId = threadId;
        this.creatorId = creatorId;
        this.guildId = guildId;
        this.username = username;
        this.model = model;
        this.currentHistory = (0, GetOriginalPrompt_1.getOriginalPrompt)(this.username);
        this.allHistory = this.currentHistory;
    }
    async persist() {
        cache[this.threadId] = this;
        this.lastUpdated = new Date().getTime();
        await db_1.db.set(ChatGPTConversation.getDBKey(this.threadId), this).catch(e => {
            (0, logMessage_1.logMessage)('failed to persist thread: ', e);
        });
    }
    static getDBKey(threadId) {
        return `${THREAD_PREFIX}${threadId}`;
    }
    static async retrieve(threadId) {
        const inCache = cache[threadId];
        if (inCache !== undefined) {
            // either null or exists
            // if null, not our thread
            return inCache;
        }
        const fromDb = await db_1.db.get(ChatGPTConversation.getDBKey(threadId));
        if (fromDb != null) {
            return await this.handleRetrievalFromDB(fromDb);
        }
        else {
            cache[threadId] = null;
        }
        return null;
    }
    static async handleRetrievalFromDB(fromDb) {
        const threadId = fromDb.threadId;
        let updatingPrompts = fromDb.numPrompts === undefined;
        if (updatingPrompts) {
            fromDb.numPrompts = fromDb.allHistory.split(constants_1.END_OF_PROMPT).slice(3).length;
            (0, logMessage_1.logMessage)(`<#${fromDb.threadId}>: ${fromDb.numPrompts} prompts.`);
        }
        const result = new ChatGPTConversation(threadId, fromDb.creatorId, fromDb.guildId, fromDb.username, fromDb.model ?? 'text-davinci-003');
        Object.assign(result, fromDb);
        cache[threadId] = result;
        if (updatingPrompts) {
            await result.persist();
        }
        return result;
    }
    async SendPromptToGPTChat(openai, user, message, onProgress) {
        const newPromptText = `
(${user.username}|${user.id}): ${message}${constants_1.END_OF_PROMPT}
${this.username}:`;
        let newHistory = this.currentHistory + newPromptText;
        let finished = false;
        let result = '';
        (0, logMessage_1.logMessage)(`<#${this.threadId}> ${user.username}: ${message}`);
        while (!finished) {
            let response;
            let newHistoryTokens = (0, gpt_3_encoder_1.encode)(newHistory).length;
            const maxallowedtokens = ModelInfo_1.ModelInfo[this.model].MAX_ALLOWED_TOKENS;
            if (newHistoryTokens > maxallowedtokens) {
                const allPrompts = newHistory.split(constants_1.END_OF_PROMPT);
                const userPrompts = allPrompts.slice(3);
                let numPromptsToRemove = 0;
                let totalTokens = 0;
                const tokensToRemove = newHistoryTokens - maxallowedtokens;
                (0, logMessage_1.logMessage)(`<#${this.threadId}> need to remove tokens...`, {
                    total: newHistoryTokens,
                    maxallowedtokens,
                    tokensToRemove,
                });
                while (numPromptsToRemove < userPrompts.length) {
                    totalTokens += (0, gpt_3_encoder_1.encode)(userPrompts[numPromptsToRemove]).length;
                    numPromptsToRemove++;
                    if (totalTokens > tokensToRemove) {
                        break;
                    }
                }
                (0, logMessage_1.logMessage)(`<#${this.threadId}> removed prompts:`, userPrompts.slice(0, numPromptsToRemove));
                // truncate parts of earlier history...
                newHistory = allPrompts.slice(0, 3)
                    .concat(userPrompts.slice(numPromptsToRemove))
                    .join(constants_1.END_OF_PROMPT);
            }
            try {
                const maxTokens = ModelInfo_1.ModelInfo[this.model].MAX_TOKENS_PER_MESSAGE;
                response = await openai.createCompletion({
                    model: this.model,
                    prompt: newHistory,
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
                }
            }
            if (response) {
                if (response.status === 200) {
                    const choices = response.data.choices;
                    if (choices.length !== 1) {
                        (0, logMessage_1.logMessage)('Not enough choices?!');
                        return null;
                    }
                    const choice = choices[0];
                    const text = choice.text;
                    newHistory += text;
                    result += text;
                    if (text == undefined) {
                        (0, logMessage_1.logMessage)('No text?!');
                        return null;
                    }
                    if (choice.finish_reason === 'stop') {
                        finished = true;
                        newHistory += constants_1.END_OF_TEXT;
                        this.currentHistory = newHistory;
                        (0, logMessage_1.logMessage)(`<#${this.threadId}> response: ${result}`);
                        this.allHistory += newPromptText + result + constants_1.END_OF_TEXT;
                        this.numPrompts++;
                        await this.persist();
                        if (onProgress) {
                            onProgress(result, true);
                        }
                        return result;
                    }
                    else {
                        if (onProgress) {
                            onProgress(result, false);
                        }
                        finished = false;
                    }
                }
                else {
                    (0, logMessage_1.logMessage)('Bad response', response.data);
                    finished = true;
                }
            }
        }
        return null;
    }
    async handlePrompt(user, channel, inputValue, messageToReplyTo) {
        let openai;
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
            const debugInfo = { lastUpdated };
            const debugMessage = `Debug: 
\`\`\`json
${JSON.stringify(debugInfo, null, '  ')}
\`\`\``;
            await (0, TrySendingMessage_1.trySendingMessage)(channel, { content: debugMessage }, messageToReplyTo);
            return;
        }
        await channel.sendTyping();
        const multi = new MultiMessage_1.MultiMessage(channel, undefined, messageToReplyTo);
        if (messageToReplyTo) {
            this.lastDiscordMessageId = messageToReplyTo.id;
        }
        await this.SendPromptToGPTChat(openai, user, inputValue, (result, finished) => {
            multi.update(result, finished);
            if (finished && multi.messageList.length > 0) {
                this.lastDiscordMessageId = multi.messageList[multi.messageList.length - 1].message.id;
                this.persist();
            }
        });
    }
    static async initialise(callback) {
        const results = await db_1.db.find({
            key: { $regex: /^THREAD-/ },
            $and: [
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
        (0, logMessage_1.logMessage)(`Found ${results.length} number of threads to check.`);
        await Promise.all(results.map(async (result) => {
            const fromDb = result.value;
            const info = await this.handleRetrievalFromDB(fromDb);
            if (info != null) {
                try {
                    await callback(info);
                }
                catch (e) {
                    (0, logMessage_1.logMessage)('Failed to initialise info with thread is ', info.threadId, e);
                }
            }
        }));
        (0, logMessage_1.logMessage)('Initialisation complete.');
    }
}
exports.ChatGPTConversation = ChatGPTConversation;
//# sourceMappingURL=ChatGPTConversation.js.map