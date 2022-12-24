"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatGPTConversationVersion0 = void 0;
const db_1 = require("../database/db");
const MultiMessage_1 = require("../shared/MultiMessage");
const logMessage_1 = require("../utils/logMessage");
const GetEnv_1 = require("../utils/GetEnv");
const GetMissingAPIKeyResponse_1 = require("../utils/GetMissingAPIKeyResponse");
const ModelInfo_1 = require("./ModelInfo");
const GetOriginalPrompt_1 = require("./GetOriginalPrompt");
const constants_1 = require("./constants");
const GetOpenAIKeyForId_1 = require("./GetOpenAIKeyForId");
const TrySendingMessage_1 = require("./TrySendingMessage");
const discordClient_1 = require("../discord/discordClient");
const BaseConversation_1 = require("./BaseConversation");
const EncodeLength_1 = require("./EncodeLength");
const ChatGPTConversation_1 = require("./ChatGPTConversation");
class ChatGPTConversationVersion0 extends BaseConversation_1.BaseConversation {
    username;
    model;
    lastUpdated = 0;
    lastDiscordMessageId = null;
    allHistory = '';
    numPrompts = 0;
    currentHistory = '';
    isDirectMessage = false;
    constructor(threadId, creatorId, guildId, username, model) {
        super(threadId, creatorId, guildId);
        this.username = username;
        this.model = model;
        this.currentHistory = (0, GetOriginalPrompt_1.getOriginalPrompt)(this.username);
        this.allHistory = this.currentHistory;
    }
    static async handleRetrievalFromDB(fromDb) {
        const threadId = fromDb.threadId;
        let updatingPrompts = fromDb.numPrompts === undefined;
        if (updatingPrompts) {
            fromDb.numPrompts = fromDb.allHistory.split(constants_1.END_OF_PROMPT).slice(3).length;
            (0, logMessage_1.logMessage)(`${await BaseConversation_1.BaseConversation.GetLinkableId(fromDb)}: ${fromDb.numPrompts} prompts.`);
        }
        const result = new ChatGPTConversationVersion0(threadId, fromDb.creatorId, fromDb.guildId, fromDb.username, fromDb.model ?? 'text-davinci-003');
        Object.assign(result, fromDb);
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
        while (!finished) {
            let response;
            let newHistoryTokens = (0, EncodeLength_1.encodeLength)(newHistory);
            const maxallowedtokens = ModelInfo_1.ModelInfo[this.model].MAX_ALLOWED_TOKENS;
            if (newHistoryTokens > maxallowedtokens) {
                const allPrompts = newHistory.split(constants_1.END_OF_PROMPT);
                const userPrompts = allPrompts.slice(3);
                let numPromptsToRemove = 0;
                let totalTokens = 0;
                const tokensToRemove = newHistoryTokens - maxallowedtokens;
                (0, logMessage_1.logMessage)(`${await this.getLinkableId()} need to remove tokens...`, {
                    total: newHistoryTokens,
                    maxallowedtokens,
                    tokensToRemove,
                });
                while (numPromptsToRemove < userPrompts.length) {
                    totalTokens += (0, EncodeLength_1.encodeLength)(userPrompts[numPromptsToRemove]);
                    numPromptsToRemove++;
                    if (totalTokens > tokensToRemove) {
                        break;
                    }
                }
                (0, logMessage_1.logMessage)(`${await this.getLinkableId()} removed prompts:`, userPrompts.slice(0, numPromptsToRemove));
                // truncate parts of earlier history...
                newHistory = allPrompts.slice(0, 3)
                    .concat(userPrompts.slice(numPromptsToRemove))
                    .join(constants_1.END_OF_PROMPT);
            }
            try {
                const maxTokens = ModelInfo_1.ModelInfo[this.model].MAX_TOKENS_PER_RESPONSE;
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
                    (0, logMessage_1.logMessage)(`RESPONSE: ${await this.getLinkableId()} ${result}`);
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
        }
        return null;
    }
    async handlePrompt(user, channel, inputValue, messageToReplyTo) {
        let openai;
        (0, logMessage_1.logMessage)(`PROMPT: by [${user.username}] in ${await this.getLinkableId()}: ${inputValue}`);
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
    async getDebugName(user) {
        return this.isDirectMessage ? user.username : await (0, discordClient_1.getGuildName)(this.guildId);
    }
    static async initialiseAll() {
        const results = await db_1.db.find({
            key: { $regex: /^THREAD-/ },
            $and: [
                {
                    "value.version": { $exists: false }
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
        (0, logMessage_1.logMessage)(`Found ${results.length} number of version0 threads to check.`);
        await Promise.all(results.map(async (result) => {
            const fromDb = result.value;
            const upgraded = await ChatGPTConversation_1.ChatGPTConversation.upgrade(fromDb);
            if (upgraded != null) {
                await upgraded.initialise();
                return;
            }
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
}
exports.ChatGPTConversationVersion0 = ChatGPTConversationVersion0;
//# sourceMappingURL=ChatGPTConversationVersion0.js.map