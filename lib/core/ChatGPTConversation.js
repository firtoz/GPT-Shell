"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatGPTConversation = exports.ignoreInput = exports.messageToPromptPart = void 0;
const db_1 = require("../database/db");
const MultiMessage_1 = require("../shared/MultiMessage");
const discord_js_1 = require("discord.js");
const logMessage_1 = require("../utils/logMessage");
const GetEnv_1 = require("../utils/GetEnv");
const GetMissingAPIKeyResponse_1 = require("../utils/GetMissingAPIKeyResponse");
const GetOpenAIForId_1 = require("./GetOpenAIForId");
const TrySendingMessage_1 = require("./TrySendingMessage");
const discordClient_1 = require("../discord/discordClient");
const BaseConversation_1 = require("./BaseConversation");
const GetOriginalPrompt_1 = require("./GetOriginalPrompt");
const EncodeLength_1 = require("./EncodeLength");
const constants_1 = require("./constants");
const GetLastMessagesUntilMaxTokens_1 = require("./GetLastMessagesUntilMaxTokens");
const uuid_1 = require("uuid");
const process = __importStar(require("process"));
const config_1 = require("./config");
const pinecone_1 = require("./pinecone");
const GetMessageCountForUser_1 = require("./GetMessageCountForUser");
const ImageHandler_1 = require("./ImageHandler");
const GetDateString_1 = require("../utils/GetDateString");
const ConversationFactory_1 = require("./ConversationFactory");
const WolframHandler_1 = require("./WolframHandler");
const adminPingId = (0, GetEnv_1.getEnv)('ADMIN_PING_ID');
const CONFIG_COMMAND_NAME = (0, GetEnv_1.getEnv)('CONFIG_COMMAND_NAME');
// Binary search algorithm
function binarySearchIndex(numbers, targetNumber) {
    let start = 0;
    let end = numbers.length - 1;
    while (start <= end) {
        let mid = Math.floor((start + end) / 2);
        if (numbers[mid] === targetNumber) {
            return mid;
        }
        else if (numbers[mid] < targetNumber) {
            start = mid + 1;
        }
        else {
            end = mid - 1;
        }
    }
    return -1;
}
const messageFormattedDateTime = (date) => {
    return date.toLocaleString('default', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).replace(/,\s+/g, ' ');
};
const messageToPromptPart = (item) => {
    const endOfPrompt = item.type === 'response' ? constants_1.END_OF_PROMPT : '';
    const timeInfo = item.timestamp ? `[${messageFormattedDateTime(new Date(item.timestamp))}] ` : '';
    return `${timeInfo}${item.username}:${endOfPrompt} ${item.content.trimStart()}`;
};
exports.messageToPromptPart = messageToPromptPart;
function ignoreInput(inputValue) {
    return inputValue.match(/^\s*~/) || inputValue.match(/^\s*\[\[\s*ps+t\s*\]\]/i);
}
exports.ignoreInput = ignoreInput;
class ChatGPTConversation extends BaseConversation_1.BaseConversation {
    username;
    model;
    static latestVersion = 3;
    messageHistory = [];
    messageHistoryMap = {};
    nextEmbedCheck = 0;
    customPrompt = null;
    temperature = 0.8;
    showUsername = true;
    makePrivate = false;
    summary = '';
    nextSummaryMessageCount = 5;
    allowExternals = false;
    shownAllowExternalsInfo = false;
    version = ChatGPTConversation.latestVersion;
    constructor(threadId, creatorId, guildId, username, model) {
        super(threadId, creatorId, guildId);
        this.username = username;
        this.model = model;
    }
    static async handleRetrievalFromDB(fromDb) {
        let versionUpgraded = false;
        if (fromDb.version === 2) {
            (0, logMessage_1.logMessage)(`trying to upgrade from v2 ${await BaseConversation_1.BaseConversation.GetLinkableId(fromDb)}(${fromDb.threadId})!`);
            fromDb.messageHistoryMap = {};
            const historyItems = fromDb.messageHistory;
            for (let i = 0; i < historyItems.length; i++) {
                let historyItem = historyItems[i];
                historyItem.id = (0, uuid_1.v4)();
                fromDb.messageHistoryMap[historyItem.id] = historyItem;
                fromDb.messageHistory[i] = historyItem.id;
            }
            fromDb.version = ChatGPTConversation.latestVersion;
            versionUpgraded = true;
        }
        const result = new ChatGPTConversation(fromDb.threadId, fromDb.creatorId, fromDb.guildId, fromDb.username, fromDb.model);
        Object.assign(result, fromDb);
        if (versionUpgraded) {
            (0, logMessage_1.logMessage)(`upgraded from v2 ${await BaseConversation_1.BaseConversation.GetLinkableId(fromDb)}(${fromDb.threadId})!`);
            await result.persist();
        }
        return result;
    }
    async createHumanMessage(openai, user, message) {
        const messageId = (0, uuid_1.v4)();
        const timestamp = new Date().getTime();
        const newMessageItem = {
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
        newMessageItem.numTokens = (0, EncodeLength_1.encodeLength)((0, exports.messageToPromptPart)(newMessageItem));
        return newMessageItem;
    }
    async createResponseMessage(openai, botUsername, user, message, usageInfo) {
        const messageId = (0, uuid_1.v4)();
        const timestamp = new Date().getTime();
        const embeddingId = await this.tryCreateEmbeddingForMessage(openai, user, message, timestamp, messageId);
        const newMessageItem = {
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
        newMessageItem.numTokens = (0, EncodeLength_1.encodeLength)((0, exports.messageToPromptPart)(newMessageItem));
        return newMessageItem;
    }
    async tryCreateEmbeddingForMessage(openai, user, message, timestamp, messageId) {
        let embeddingId = null;
        const pinecone = await (0, pinecone_1.getPineconeClient)();
        if (pinecone) {
            embeddingId = (0, uuid_1.v4)();
            try {
                const embeddings = await openai.createEmbedding({
                    user: user.id,
                    input: message,
                    model: 'text-embedding-ada-002',
                });
                const vector = {
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
            }
            catch (e) {
                if (e.isAxiosError) {
                    // response = e.response;
                    (0, logMessage_1.logMessage)(`Could not create embedding... ${await this.getLinkableId()}`, e.response.data);
                }
                else {
                    const adminPingId = (0, GetEnv_1.getEnv)('ADMIN_PING_ID');
                    (0, logMessage_1.logMessage)(`${adminPingId ? `<@${adminPingId}>` : ''}! Could not create embedding... ${await this.getLinkableId()}`, e);
                }
                embeddingId = null;
            }
        }
        return embeddingId;
    }
    async SendPromptToGPTChat(config, usingOpenAIForServer, openai, user, message, onProgress) {
        const modelInfo = config.modelInfo[this.model];
        let finished = false;
        let numRetries = 0;
        const maxRetries = 3;
        let latestResponseText = '';
        let usageInfo = [];
        const relevancyResultsCache = {
            searchPerformed: false,
            results: [],
        };
        const inputMessageItem = await this.createHumanMessage(openai, user, message);
        while (!finished) {
            let response;
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
                    onProgress(`[[Whoops, ran out of tokens :( Contact your OpenAI account holder please.${usingOpenAIForServer ? `

You can alternatively supply your own API key to me by sending me the /${CONFIG_COMMAND_NAME} command in a DM.` : ''}]]`, true);
                }
                else if (data.error?.message) {
                    (0, logMessage_1.logMessage)('Bad response', response.data, { numRetries, maxRetries });
                    if (numRetries < maxRetries) {
                        numRetries++;
                        continue;
                    }
                    onProgress(`[[Error from OpenAI servers: "${data.error.message}"]]`, true);
                }
                else {
                    onProgress('[[Unknown error from OpenAI servers. Please ping the bot owner for help.]]', true);
                }
                (0, logMessage_1.logMessage)('Bad response', response.data);
                finished = true;
                break;
            }
            const choices = response.data.choices;
            if (choices.length !== 1) {
                (0, logMessage_1.logMessage)('Not enough choices?!');
                finished = true;
                return;
            }
            const choice = choices[0];
            const text = choice.text;
            if (text == undefined) {
                (0, logMessage_1.logMessage)('No text?!');
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
            }
            else {
                if (onProgress) {
                    onProgress(latestResponseText, true);
                }
                finished = true;
                const embeddingPromise = this.tryCreateEmbeddingForMessage(openai, user, inputMessageItem.content, inputMessageItem.timestamp, inputMessageItem.id);
                const createResponseMessagePromise = this.createResponseMessage(openai, this.username, user, latestResponseText, usageInfo);
                inputMessageItem.embedding = await embeddingPromise;
                const responseMessage = await createResponseMessagePromise;
                this.messageHistoryMap[inputMessageItem.id] = inputMessageItem;
                this.messageHistory.push(inputMessageItem.id);
                this.messageHistory.push(responseMessage.id);
                this.messageHistoryMap[responseMessage.id] = responseMessage;
                (0, logMessage_1.logMessage)(`RESPONSE: ${await this.getLinkableId()} ${latestResponseText}`, 'usage', response.data.usage);
                await this.persist();
                return;
            }
        }
        return;
    }
    async handlePrompt(user, channel, inputValue, messageToReplyTo) {
        if (ignoreInput(inputValue)) {
            return;
        }
        const userId = user.id;
        if (this.makePrivate && !channel.isDMBased() && !channel.isThread() && channel.isTextBased()) {
            if (channel.type === discord_js_1.ChannelType.GuildText) {
                const threadName = `${user.username} - ${inputValue ?? (0, GetDateString_1.getDateString)(new Date())}`
                    .substring(0, 80);
                const newThread = await channel.threads.create({
                    name: threadName,
                    reason: 'ChatGPT',
                    autoArchiveDuration: discord_js_1.ThreadAutoArchiveDuration.OneHour,
                    type: discord_js_1.ChannelType.PrivateThread,
                });
                const conversation = ConversationFactory_1.ConversationFactory.create(newThread.id, userId, channel.guildId, discordClient_1.discordClient.user.username, this.model);
                conversation.username = this.username;
                conversation.customPrompt = this.customPrompt;
                conversation.temperature = this.temperature;
                conversation.showUsername = this.showUsername;
                await conversation.persist();
                await (0, TrySendingMessage_1.trySendingMessage)(newThread, {
                    embeds: [
                        new discord_js_1.EmbedBuilder()
                            .setAuthor({
                            name: user.username,
                            iconURL: user.avatarURL() ?? undefined,
                        })
                            .setDescription(inputValue),
                    ],
                });
                await newThread.members.add(userId);
                await conversation.handlePrompt(user, newThread, inputValue);
                const newMessage = await (0, TrySendingMessage_1.trySendingMessage)(newThread, {
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
        let openai;
        (0, logMessage_1.logMessage)(`PROMPT: [${user.username}] in ${await this.getLinkableId()}: ${inputValue}`);
        const configId = this.isDirectMessage ? userId : this.guildId;
        let usingOpenAIForServer = false;
        let currentConfig = await (0, config_1.getConfigForId)(userId);
        if (this.isDirectMessage || currentConfig.useKeyInServersToo) {
            openai = await (0, GetOpenAIForId_1.getOpenAIForId)(userId);
        }
        if (!this.isDirectMessage && !openai) {
            openai = await (0, GetOpenAIForId_1.getOpenAIForId)(this.guildId);
            usingOpenAIForServer = true;
            currentConfig = await (0, config_1.getConfigForId)(configId);
        }
        if (usingOpenAIForServer && currentConfig.maxMessagePerUser !== -1) {
            const messageCounter = await (0, config_1.getMessageCounter)(configId);
            const messageCountForUser = (0, GetMessageCountForUser_1.getMessageCountForUser)(messageCounter, userId);
            if (messageCountForUser.nextReset < new Date().getTime()) {
                messageCountForUser.limitCount = 0;
                messageCountForUser.imageLimitCount = 0;
                messageCountForUser.nextReset = (0, GetMessageCountForUser_1.getNowPlusOneMonth)();
                messageCounter[userId] = messageCountForUser;
                await (0, config_1.saveMessageCounter)(configId, messageCounter);
            }
            if (messageCountForUser.limitCount > currentConfig.maxMessagePerUser) {
                const guild = await discordClient_1.discordClient.guilds.fetch(this.guildId);
                const member = await guild.members.fetch(userId);
                if (!currentConfig
                    .exceptionRoleIds
                    .some(exceptionRoleId => member.roles.cache.has(exceptionRoleId))) {
                    await (0, TrySendingMessage_1.trySendingMessage)(channel, {
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
            (0, logMessage_1.logMessage)(`No api key for [${(await this.getDebugName(user))}].`);
            const response = await (0, GetMissingAPIKeyResponse_1.getMissingAPIKeyResponse)(this.isDirectMessage);
            const MAIN_SERVER_INVITE = (0, GetEnv_1.getEnv)('MAIN_SERVER_INVITE');
            if (MAIN_SERVER_INVITE) {
                response.content += '\n' + MAIN_SERVER_INVITE;
            }
            await (0, TrySendingMessage_1.trySendingMessage)(channel, response, messageToReplyTo);
            return;
        }
        if (userId === adminPingId) {
            if (inputValue === '<EMBED>') {
                await this.tryEmbedMany(user, openai, channel, messageToReplyTo);
                return;
            }
            if (inputValue === '<TEST_MSG_LIMIT>') {
                await (0, TrySendingMessage_1.trySendingMessage)(channel, {
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
                    const guilds = await discordClient_1.discordClient.guilds.fetch();
                    const guildInfo = await Promise.all(guilds.map(async (guild) => {
                        try {
                            const guildInfo = await (0, config_1.getConfigForId)(guild.id);
                            const hasAPIKey = Boolean(guildInfo && guildInfo.openAIApiKey);
                            const threads = await db_1.db.collection.find({
                                "value.guildId": guild.id,
                            }).toArray();
                            const guildObject = await discordClient_1.discordClient.guilds.cache.get(guild.id);
                            const member = await guildObject?.members.fetch(discordClient_1.discordClient.user.id);
                            let joined = null;
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
                        }
                        catch (e) {
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
                }
                catch (e) {
                    (0, logMessage_1.logMessage)('Cannot get serverinfo: ', e);
                }
                return;
            }
        }
        const botConfig = await (0, config_1.getConfig)();
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
                const { lastUpdated, nextSummaryMessageCount } = this;
                const totalTokens = this.messageHistory.map(id => this.messageHistoryMap[id])
                    .reduce((sum, item) => sum + (0, GetLastMessagesUntilMaxTokens_1.getNumTokens)(item), 0);
                const responseTokens = this.messageHistory.map(id => this.messageHistoryMap[id])
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
                };
                if (channel.isThread()) {
                    debugInfo.nextSummaryMessageCount = nextSummaryMessageCount;
                }
                const debugMessage = `Debug: 
\`\`\`json
${JSON.stringify(debugInfo, null, '  ')}
\`\`\``;
                await (0, TrySendingMessage_1.trySendingMessage)(channel, { content: debugMessage }, messageToReplyTo);
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
                await (0, TrySendingMessage_1.trySendingMessage)(channel, {
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
===END PROMPT - TOKENS: ${(0, EncodeLength_1.encodeLength)(fullPrompt)} ===`;
            await new MultiMessage_1.MultiMessage(channel, undefined, messageToReplyTo).update(prompt, true);
            return;
        }
        const historyPrefix = '<HISTORY>';
        if (inputValue.startsWith(historyPrefix) && userId === adminPingId) {
            const historyConfig = await db_1.db.get(`HISTORY-CONFIG-${userId}`);
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
            const history = this.messageHistory.slice(this.messageHistory.length - toShow).map(id => this.messageHistoryMap[id]);
            const response = `History: \n${history.map(item => (0, exports.messageToPromptPart)(item)).join('\n')}`;
            await this.sendReply(channel, response, messageToReplyTo);
            return;
        }
        const queryPrefix = '<QUERY>';
        if (inputValue.startsWith(queryPrefix) && userId === adminPingId) {
            const pinecone = await (0, pinecone_1.getPineconeClient)();
            if (pinecone != null) {
                await this.testQuery(inputValue, queryPrefix, channel, user, openai, messageToReplyTo);
                return;
            }
            return;
        }
        try {
            channel.sendTyping().catch();
        }
        catch (e) {
            (0, logMessage_1.logMessage)(`${await this.getLinkableId()} Cannot send typing..`, e);
        }
        const multi = new MultiMessage_1.MultiMessage(channel, undefined, messageToReplyTo);
        try {
            const moderationResponse = await openai.createModeration({
                input: inputValue,
            });
            const moderationScores = moderationResponse.data.results[0].category_scores;
            const entries = Object.entries(moderationScores);
            const failures = entries.filter(([key, value]) => {
                return value > botConfig.moderationThreshold[key];
            });
            (0, logMessage_1.logMessage)(`${await this.getLinkableId()} Moderation:`, Object.fromEntries(entries.map(([key, value]) => [key, value.toFixed(2)])));
            if (failures.length > 0) {
                await multi.update(`[[MESSAGE BLOCKED!

OpenAI moderation failed:

${failures.map(([key]) => {
                    return `${key}`;
                }).join('\n')}]]`, true);
                return;
            }
        }
        catch (e) {
            (0, logMessage_1.logMessage)(`${await this.getLinkableId()} moderation fail`, e);
        }
        let promiseComplete = false;
        if (messageToReplyTo) {
            this.lastDiscordMessageId = messageToReplyTo.id;
            await this.handleSpecialKeywords(openai, inputValue, usingOpenAIForServer, userId, currentConfig, channel, messageToReplyTo);
            await this.persist();
        }
        const sendPromise = this.SendPromptToGPTChat(currentConfig, usingOpenAIForServer, openai, user, inputValue, async (result, finished) => {
            if (this.customPrompt && this.showUsername) {
                await multi.update(`${this.username}:${result}`, finished);
            }
            else {
                await multi.update(result, finished);
            }
            if (finished) {
                promiseComplete = true;
                if (multi.messageList.length > 0) {
                    const lastMessage = multi.messageList[multi.messageList.length - 1];
                    this.lastDiscordMessageId = lastMessage.message.id;
                    await this.handleSpecialKeywords(openai, result, usingOpenAIForServer, userId, currentConfig, channel, lastMessage.message);
                    await this.persist();
                }
            }
        });
        sendPromise.finally(() => {
            // complete it in case it somehow failed to send finished part
            promiseComplete = true;
        });
        const intervalId = setInterval(async () => {
            if (promiseComplete) {
                clearInterval(intervalId);
                return;
            }
            try {
                await channel.sendTyping();
            }
            catch (e) {
                (0, logMessage_1.logMessage)(`${await this.getLinkableId()} Cannot send typing..`, e);
            }
        }, 5000);
        await sendPromise;
        if (channel.isThread()) {
            if (this.messageHistory.length > this.nextSummaryMessageCount) {
                await this.trySummariseThread(openai, userId, channel);
            }
        }
        if (usingOpenAIForServer) {
            const messageCounter = await (0, config_1.getMessageCounter)(this.guildId);
            const messageCountForUser = (0, GetMessageCountForUser_1.getMessageCountForUser)(messageCounter, userId);
            messageCountForUser.count++;
            messageCountForUser.limitCount++;
            if (currentConfig.maxMessagePerUser !== -1
                && !messageCountForUser.warned
                && messageCountForUser.limitCount > currentConfig.maxMessagePerUser * 0.75) {
                const guild = await discordClient_1.discordClient.guilds.fetch(this.guildId);
                const member = await guild.members.fetch(userId);
                if (!currentConfig
                    .exceptionRoleIds
                    .some(exceptionRoleId => member.roles.cache.has(exceptionRoleId))) {
                    await channel.send({
                        content: '',
                        embeds: [
                            new discord_js_1.EmbedBuilder()
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
            await (0, config_1.saveMessageCounter)(this.guildId, messageCounter);
        }
        if (multi.messageList.length > 0) {
            this.lastDiscordMessageId = multi.messageList[multi.messageList.length - 1].message.id;
            await this.persist();
        }
    }
    async handleSpecialKeywords(openai, input, usingOpenAIForServer, userId, currentConfig, channel, messageToReplyTo) {
        const imageDescriptions = await this.getImageDescriptions(input, usingOpenAIForServer, userId, currentConfig, channel);
        if (imageDescriptions.length) {
            ImageHandler_1.ImageHandler.handle(openai, imageDescriptions, userId, messageToReplyTo).catch();
        }
        const WOLFRAM_APP_ID = (0, GetEnv_1.getEnv)('WOLFRAM_APP_ID');
        if (WOLFRAM_APP_ID) {
            const wolframDescriptions = (0, WolframHandler_1.extractWolframDescriptions)(input);
            if (wolframDescriptions.length) {
                WolframHandler_1.WolframHandler.handle(wolframDescriptions, userId, messageToReplyTo).catch();
            }
        }
    }
    async trySummariseThread(openai, userId, channel) {
        try {
            const allMessagesInHistory = this.messageHistory.map(id => this.messageHistoryMap[id]);
            const lastMessages = (0, GetLastMessagesUntilMaxTokens_1.getLastMessagesUntilMaxTokens)(allMessagesInHistory, 1000, true);
            if (lastMessages.length < 4) {
                return;
            }
            this.nextSummaryMessageCount = this.messageHistory.length + 10;
            await this.persist();
            const response = await openai.createCompletion({
                model: this.model,
                prompt: `Please create a name for a discord thread that contains this conversation:

${lastMessages.map(item => (0, exports.messageToPromptPart)(item)).join('\n')}`,
                temperature: this.temperature,
                max_tokens: 512,
                top_p: 0.9,
                frequency_penalty: 0,
                presence_penalty: 0,
                user: userId,
            });
            this.summary = response.data.choices[0].text;
            (0, logMessage_1.logMessage)(`Summary for ${await this.getLinkableId()}: ${this.summary}.
Source: ${lastMessages}`);
            await channel.setName(this.summary.slice(0, 90));
        }
        catch (e) {
            (0, logMessage_1.logMessage)(`Could not name thread ${await this.getLinkableId()}`, e);
        }
    }
    async getImageDescriptions(inputValue, usingOpenAIForServer, userId, currentConfig, channel) {
        let descriptions = (0, ImageHandler_1.extractImageDescriptions)(inputValue);
        if (descriptions.length === 0) {
            return [];
        }
        const messageCounter = await (0, config_1.getMessageCounter)(this.guildId);
        if (descriptions.length > 0) {
            const userHasExceptionRole = await this.userHasExceptionRole(userId, currentConfig);
            const userShouldBeRestricted = usingOpenAIForServer
                && currentConfig.maxImagePerUser != -1
                && userId !== adminPingId
                && !userHasExceptionRole;
            if (userShouldBeRestricted) {
                const messageCountForUser = (0, GetMessageCountForUser_1.getMessageCountForUser)(messageCounter, userId);
                if (messageCountForUser.imageLimitCount >= currentConfig.maxImagePerUser) {
                    await channel.send({
                        content: '',
                        embeds: [
                            new discord_js_1.EmbedBuilder()
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
                }
                else {
                    descriptions = this.trimDescriptions(messageCounter, userId, currentConfig, descriptions);
                    if (descriptions.length > 0) {
                        messageCountForUser.imageCount += descriptions.length;
                        messageCountForUser.imageLimitCount += descriptions.length;
                        messageCounter[userId] = messageCountForUser;
                        await (0, config_1.saveMessageCounter)(this.guildId, messageCounter);
                    }
                }
            }
        }
        return descriptions;
    }
    async userHasExceptionRole(userId, currentConfig) {
        const guild = await discordClient_1.discordClient.guilds.fetch(this.guildId);
        const member = await guild.members.fetch(userId);
        return currentConfig
            .exceptionRoleIds
            .some(exceptionRoleId => member.roles.cache.has(exceptionRoleId));
    }
    trimDescriptions(messageCounter, userId, currentConfig, descriptions) {
        const messageCountForUser = (0, GetMessageCountForUser_1.getMessageCountForUser)(messageCounter, userId);
        if (messageCountForUser.imageLimitCount >= currentConfig.maxImagePerUser) {
            return [];
        }
        const remainingImages = Math.max(currentConfig.maxImagePerUser - messageCountForUser.imageLimitCount, 0);
        if (remainingImages > 0) {
            return descriptions.slice(0, remainingImages);
        }
        else {
            return [];
        }
    }
    async deleteMessages(toDelete) {
        const deletedIndices = this.messageHistory.splice(this.messageHistory.length - toDelete);
        const pinecone = await (0, pinecone_1.getPineconeClient)();
        if (pinecone != null) {
            const embedIdsToDelete = deletedIndices
                .map(id => this.messageHistoryMap[id].embedding)
                .filter(item => item !== null);
            try {
                await pinecone.delete({
                    ids: embedIdsToDelete,
                });
                (0, logMessage_1.logMessage)('Deleted ids from pinecone:', embedIdsToDelete);
            }
            catch (e) {
                (0, logMessage_1.logMessage)('Failed to delete from pinecone: ', e);
            }
        }
        for (const id of deletedIndices) {
            delete this.messageHistoryMap[id];
        }
        await this.persist();
        return deletedIndices;
    }
    async tryEmbedMany(user, openai, channel, messageToReplyTo) {
        const config = await (0, config_1.getConfig)();
        const pinecone = await (0, pinecone_1.getPineconeClient)();
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
            }
            else {
                (0, logMessage_1.logMessage)(`${await this.getLinkableId()}: Preparing to embed ${firstN.length} messages...`);
            }
            let embeddings;
            try {
                embeddings = await openai.createEmbedding({
                    user: user.id,
                    input: firstN.map(item => item.content),
                    model: 'text-embedding-ada-002',
                });
            }
            catch (e) {
                if (messageToReplyTo && channel) {
                    await this.sendReply(channel, `Cannot create embeddings: ${(0, logMessage_1.printArg)(e)}`, messageToReplyTo);
                }
                else {
                    (0, logMessage_1.logMessage)(`${await this.getLinkableId()}: Cannot create embeddings`, e);
                }
                return;
            }
            if (messageToReplyTo && channel) {
                await this.sendReply(channel, `Embeddings created for ${firstN.length} messages.`, messageToReplyTo);
            }
            else {
                (0, logMessage_1.logMessage)(`${await this.getLinkableId()}: Embeddings created for ${firstN.length} messages.`);
            }
            const vectors = firstN.map((item, index) => {
                return {
                    id: (0, uuid_1.v4)(),
                    values: embeddings.data.data[index].embedding,
                    metadata: {
                        threadId: this.threadId,
                        timestamp: item.timestamp,
                        id: item.id,
                    },
                };
            });
            try {
                if (messageToReplyTo && channel) {
                    await this.sendReply(channel, `Inserting to pinecone...`, messageToReplyTo);
                }
                else {
                    (0, logMessage_1.logMessage)(`${await this.getLinkableId()}: Inserting to pinecone...`);
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
                }
                else {
                    (0, logMessage_1.logMessage)(`${await this.getLinkableId()}: upsert completed!`);
                }
            }
            catch (e) {
                if (messageToReplyTo && channel) {
                    await this.sendReply(channel, `Error: ${(0, logMessage_1.printArg)(e)}`, messageToReplyTo);
                }
                else {
                    (0, logMessage_1.logMessage)(`${await this.getLinkableId()}: Error while trying to save embeddings: ${(0, logMessage_1.printArg)(e)}`);
                }
            }
        }
        return;
    }
    async testQuery(inputValue, queryPrefix, channel, user, openai, messageToReplyTo) {
        const pinecone = await (0, pinecone_1.getPineconeClient)();
        if (!pinecone) {
            return [];
        }
        let rest = inputValue.slice(queryPrefix.length);
        const firstCommaIndex = rest.indexOf(',');
        if (firstCommaIndex == -1) {
            await (0, TrySendingMessage_1.trySendingMessage)(channel, {
                content: `<QUERY> [time-weight (from 0 to 1)], PROMPT MESSAGE`,
            });
            return;
        }
        const orderWeight = parseFloat(rest.slice(0, firstCommaIndex).trim());
        if (isNaN(orderWeight) || orderWeight < 0 || orderWeight > 1) {
            await (0, TrySendingMessage_1.trySendingMessage)(channel, {
                content: `<QUERY> [time-weight (NUMBER from 0 to 1)], PROMPT MESSAGE`,
            });
            return;
        }
        const input = rest.slice(firstCommaIndex + 1).trimStart();
        let embeddings;
        try {
            embeddings = await openai.createEmbedding({
                user: user.id,
                input: input,
                model: 'text-embedding-ada-002',
            });
        }
        catch (e) {
            (0, logMessage_1.logMessage)(`${await this.getLinkableId()}: Cannot create embeddings`, e);
            return;
        }
        const vector = embeddings.data.data[0].embedding;
        const messages = await this.getRelevantMessages(user, openai, orderWeight, vector);
        if (messages.length === 0) {
            await this.sendReply(channel, `No relevant messages found. Either no pinecone config, or ran out of OpenAI tokens.`, messageToReplyTo);
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
            return `- ${indexString} S:${scoreString} O:${orderString} W:${weightString} ${(0, GetLastMessagesUntilMaxTokens_1.getNumTokens)(item.message).toString().padStart(4, '0')}
${(0, exports.messageToPromptPart)(item.message)}`;
        }).join('\n');
        await this.sendReply(channel, `Result:\n${resultString}`, messageToReplyTo);
        return;
    }
    async getFullPrompt(config, openai, user, inputMessageItem, latestResponseText, relevancyCheckCache, debug = false) {
        let initialPrompt;
        if (this.customPrompt) {
            initialPrompt = (0, GetOriginalPrompt_1.getCustomPrompt)(this.username, this.customPrompt);
        }
        else {
            initialPrompt = (0, GetOriginalPrompt_1.getOriginalPrompt)(this.username);
        }
        const modelInfo = config.modelInfo[this.model];
        const numInitialPromptTokens = (0, EncodeLength_1.encodeLength)(initialPrompt);
        const currentResponseTokens = (0, EncodeLength_1.encodeLength)(latestResponseText);
        const inputTokens = (0, EncodeLength_1.encodeLength)((0, exports.messageToPromptPart)(inputMessageItem));
        let availableTokens = modelInfo.MAX_ALLOWED_TOKENS - numInitialPromptTokens - currentResponseTokens - inputTokens;
        const allMessagesInHistory = this.messageHistory.map(id => this.messageHistoryMap[id]);
        let needFix = false;
        const totalTokensFromHistory = allMessagesInHistory.reduce((sum, item) => {
            if (!item.fixedTokens) {
                needFix = true;
            }
            return sum + (0, GetLastMessagesUntilMaxTokens_1.getNumTokens)(item);
        }, 0);
        if (needFix) {
            await this.persist();
        }
        if (totalTokensFromHistory < availableTokens) {
            // use only messages, it's simpler
            return `${initialPrompt}${debug ? '\nDEBUG: ALL MESSAGES:' : ''}
${allMessagesInHistory.concat(inputMessageItem).map(exports.messageToPromptPart).join('\n')}
[${messageFormattedDateTime(new Date())}] ${this.username}:${constants_1.END_OF_PROMPT}${latestResponseText}`;
        }
        const tokensForRecentMessages = Math.min(config.maxTokensForRecentMessages, availableTokens);
        const latestMessages = (0, GetLastMessagesUntilMaxTokens_1.getLastMessagesUntilMaxTokens)(allMessagesInHistory, tokensForRecentMessages, true);
        if (!relevancyCheckCache.searchPerformed) {
            // check relevancy using last 4 messages.
            const last4 = allMessagesInHistory.slice(-4);
            const relevantMessageInput = last4
                .map(item => item.content)
                .concat(inputMessageItem.content)
                .join('\n');
            let embeddings;
            let vector = null;
            try {
                embeddings = await openai.createEmbedding({
                    user: user.id,
                    input: relevantMessageInput,
                    model: 'text-embedding-ada-002',
                });
                vector = embeddings.data.data[0].embedding;
            }
            catch (e) {
                (0, logMessage_1.logMessage)(`${await this.getLinkableId()}: Cannot create embeddings`, e);
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
            .reduce((sum, item) => sum + (0, GetLastMessagesUntilMaxTokens_1.getNumTokens)(item), 0);
        availableTokens -= usedTokensFromMessages;
        const includedRelevantMessages = [];
        for (const relevantMessage of unseenRelevantMessages) {
            if ((0, GetLastMessagesUntilMaxTokens_1.getNumTokens)(relevantMessage.message) < availableTokens) {
                includedRelevantMessages.push(relevantMessage);
                availableTokens -= (0, GetLastMessagesUntilMaxTokens_1.getNumTokens)(relevantMessage.message);
            }
            if (availableTokens < 50) {
                break;
            }
        }
        includedRelevantMessages
            .sort((a, b) => a.match.index - b.match.index);
        let relevantPrefix;
        let relevantSuffix;
        if (debug) {
            relevantPrefix = `---RELEVANT--`;
            relevantSuffix = `---END RELEVANT - TOKENS: ${includedRelevantMessages.reduce((sum, item) => sum + (0, GetLastMessagesUntilMaxTokens_1.getNumTokens)(item.message), 0)} ---`;
        }
        else {
            relevantPrefix = 'Earlier history:';
            relevantSuffix = 'Recent history:';
        }
        const latestMessagesAndCurrentPrompt = latestMessagesPlusNewMessage.map(exports.messageToPromptPart).join('\n');
        return `${initialPrompt}
${includedRelevantMessages.length > 0 ? `${relevantPrefix}
${includedRelevantMessages.map(item => (0, exports.messageToPromptPart)(item.message)).join('\n')}
${includedRelevantMessages.length > 0 ? relevantSuffix : ''}
` : ''}
${latestMessagesAndCurrentPrompt}${debug ? `
---LATEST LENGTH: ${(0, EncodeLength_1.encodeLength)(latestMessagesAndCurrentPrompt)}---` : ''}
[${messageFormattedDateTime(new Date())}] ${this.username}:${constants_1.END_OF_PROMPT}${latestResponseText}`;
    }
    async getRelevantMessages(user, openai, orderWeight, vector) {
        try {
            const pinecone = await (0, pinecone_1.getPineconeClient)();
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
            const queryParams = {
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
                .filter(ts => ts !== undefined);
            const sorted = queryResult.matches.map(match => {
                return {
                    index: binarySearchIndex(timestamps, match.metadata.timestamp),
                    score: match.score,
                };
            }).filter(match => match.index !== -1);
            // message id to max score map
            const wantedMessages = {};
            for (const match of sorted) {
                const index = match.index;
                const matchingMessage = this.messageHistoryMap[this.messageHistory[match.index]];
                wantedMessages[index] = Math.max(wantedMessages[index] ?? 0, match.score);
                if (matchingMessage.type === 'human') {
                    if (this.messageHistory.length > index + 1) {
                        wantedMessages[index + 1] = Math.max(wantedMessages[index + 1] ?? 0, match.score);
                    }
                }
                else {
                    if (index > 0) {
                        wantedMessages[index - 1] = Math.max(wantedMessages[index - 1] ?? 0, match.score);
                    }
                }
            }
            const entries = Object
                .entries(wantedMessages);
            return entries.map(([index, score]) => {
                const matchingMessage = this.messageHistoryMap[this.messageHistory[index]];
                const orderRanking = (index / this.messageHistory.length);
                const weighted = score * scoreWeight + orderWeight * orderRanking;
                const relevancyMatch = {
                    index,
                    score,
                    weighted,
                    orderRanking,
                };
                return {
                    match: relevancyMatch,
                    message: matchingMessage,
                };
            });
        }
        catch (e) {
            (0, logMessage_1.logMessage)('cannot get relevant messages', e);
            return [];
        }
    }
    sendReply(channel, message, messageToReplyTo) {
        return new MultiMessage_1.MultiMessage(channel, undefined, messageToReplyTo).update(message, true);
    }
    async getDebugName(user) {
        return this.isDirectMessage ? user.username : await (0, discordClient_1.getGuildName)(this.guildId);
    }
    static async initialiseAll() {
        const results = await db_1.db.find({
            key: { $regex: /^THREAD-/ },
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
                            "value.deleted": { $exists: false }
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
                    (0, logMessage_1.logMessage)('Failed to initialise info with thread id ', info.threadId, e);
                }
            }
        }));
        (0, logMessage_1.logMessage)('Initialisation complete.');
    }
}
exports.ChatGPTConversation = ChatGPTConversation;
//# sourceMappingURL=ChatGPTConversation.js.map