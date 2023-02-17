"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BaseConversation = void 0;
const db_1 = require("../database/db");
const logMessage_1 = require("../utils/logMessage");
const discord_js_1 = require("discord.js");
const discordClient_1 = require("../discord/discordClient");
const ConversationCache_1 = require("./ConversationCache");
const TrySendingMessage_1 = require("./TrySendingMessage");
const getWhimsicalResponse_1 = require("../discord/listeners/ready/getWhimsicalResponse");
const messageReceivedInThread_1 = require("../discord/listeners/ready/message-handling/messageReceivedInThread");
const GetEnv_1 = require("../utils/GetEnv");
const THREAD_PREFIX = `THREAD-`;
function createChannelLink(threadId) {
    return `<#${threadId}>|${threadId}`;
}
function createUserLink(creatorId) {
    return `<@${creatorId}>|${creatorId}`;
}
class BaseConversation {
    threadId;
    creatorId;
    guildId;
    isDirectMessage = false;
    lastUpdated = 0;
    lastDiscordMessageId = null;
    deleted = false;
    constructor(threadId, creatorId, guildId) {
        this.threadId = threadId;
        this.creatorId = creatorId;
        this.guildId = guildId;
    }
    static getDBKey(threadId) {
        return `${THREAD_PREFIX}${threadId}`;
    }
    async persist() {
        ConversationCache_1.conversationCache[this.threadId] = this;
        this.lastUpdated = new Date().getTime();
        await db_1.db.set(BaseConversation.getDBKey(this.threadId), this).catch(e => {
            (0, logMessage_1.logMessage)('failed to persist thread: ', e);
        });
    }
    async tryGetThread(server) {
        return await BaseConversation.TryGetThread(server, this.threadId);
    }
    static async TryGetThread(server, threadId) {
        try {
            const result = await server.channels.fetch(threadId);
            if (result == null) {
                return {
                    success: false,
                    status: -1,
                    error: new Error('...'),
                };
            }
            return {
                success: true,
                thread: result,
            };
        }
        catch (e) {
            if (e instanceof discord_js_1.DiscordAPIError) {
                switch (e.status) {
                    case 404:
                        return {
                            success: false,
                            status: 404,
                            error: e,
                        };
                    default:
                        break;
                }
                (0, logMessage_1.logMessage)('INITIALIZEThreads', e.status);
                return {
                    success: false,
                    status: e.status,
                    error: e,
                };
            }
            (0, logMessage_1.logMessage)('INITIALIZEThreads', e);
            return {
                success: false,
                status: -1,
                error: e,
            };
        }
    }
    async getLinkableId() {
        return BaseConversation.GetLinkableId(this);
    }
    static async GetLinkableId(conversation) {
        let location = '';
        if (conversation.isDirectMessage) {
            const creatorId = conversation.creatorId;
            const user = await discordClient_1.discordClient.users.fetch(creatorId);
            if (user) {
                location = `[[DM with [${user.username}|${createUserLink(creatorId)}]]`;
            }
            else {
                location = `[[DM with [${createUserLink(creatorId)}]]]`;
            }
        }
        else {
            const guild = await discordClient_1.discordClient.guilds.fetch(conversation.guildId);
            const channelLink = createChannelLink(conversation.threadId);
            const channel = await discordClient_1.discordClient.channels.fetch(conversation.threadId);
            if (channel) {
                if (channel.isThread()) {
                    if (guild) {
                        location = `[[THREAD [${guild.name}][${channelLink}]]]`;
                    }
                    else {
                        location = `[[THREAD [${conversation.guildId}][${channelLink}]]]`;
                    }
                }
                else {
                    if (guild) {
                        location = `[[CHANNEL [${guild.name}][${channelLink}]]]`;
                    }
                    else {
                        location = `[[CHANNEL [${conversation.guildId}][${channelLink}]]]`;
                    }
                }
            }
            else {
                if (guild) {
                    location = `[[UNKNOWN [${guild.name}][${channelLink}]]]`;
                }
                else {
                    location = `[[UNKNOWN [${conversation.guildId}][${channelLink}]]]`;
                }
            }
        }
        return location;
    }
    async initialise() {
        (0, logMessage_1.logMessage)(`Initialising conversation: ${await this.getLinkableId()}.`);
        const currentBotId = discordClient_1.discordClient.user.id;
        if (this.isDirectMessage) {
            const channel = await discordClient_1.discordClient.channels.fetch(this.threadId);
            if (!channel) {
                return;
            }
            if (!channel.isDMBased()) {
                return;
            }
            if (!channel.isTextBased()) {
                return;
            }
            const user = await discordClient_1.discordClient.users.fetch(this.creatorId);
            if (!user) {
                // cannot find user
                return;
            }
            let newMessagesCollection;
            if (this.lastDiscordMessageId == null) {
                newMessagesCollection = await channel.messages.fetch({
                    limit: 20,
                });
            }
            else {
                newMessagesCollection = await channel.messages.fetch({
                    after: this.lastDiscordMessageId,
                });
            }
            let newMessages = Array.from(newMessagesCollection.values());
            newMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
            (0, logMessage_1.logMessage)(`DM [${user.username}] new messages: ${newMessages.length}.`);
            await Promise.all(newMessages.map(newMessage => newMessage.fetch()));
            newMessages = newMessages.filter(message => message.author.id !== currentBotId);
            if (newMessages.length === 0) {
                console.log('No new messages, ignoring.');
                return;
            }
            let lastMessage = newMessages[newMessages.length - 1];
            await (0, TrySendingMessage_1.trySendingMessage)(channel, {
                content: `[[${(0, getWhimsicalResponse_1.getWhimsicalResponse)(user.id)}

I will respond to this message now.]]`
            });
            this.handlePrompt(lastMessage.author, channel, lastMessage.content, lastMessage)
                .catch(e => (0, logMessage_1.logMessage)('INITIALIZEThreads', 'failed to handle prompt...', e));
            return;
        }
        if (this.guildId === null) {
            (0, logMessage_1.logMessage)('no guild for info: ', this);
            const guilds = Array.from(discordClient_1.discordClient.guilds.cache.values());
            for (const server of guilds) {
                const channel = await server.channels.fetch(this.threadId);
                if (channel != null) {
                    (0, logMessage_1.logMessage)('found guild for info: ', this, server.id);
                    this.guildId = server.id;
                    await this.persist();
                }
            }
        }
        const server = discordClient_1.discordClient.guilds.cache.get(this.guildId);
        if (server == null) {
            (0, logMessage_1.logMessage)('INITIALIZEThreads', 'server null for info', this.guildId);
            return;
        }
        const threadResponse = await this.tryGetThread(server);
        if (!threadResponse.success) {
            (0, logMessage_1.logMessage)(`${await this.getLinkableId()}: Failed to get thread, status: ${threadResponse.status}`);
            if (threadResponse.status === 404) {
                (0, logMessage_1.logMessage)(`Thread ${await this.getLinkableId()} deleted (or never existed)! Marking as deleted...`);
                this.deleted = true;
                await this.persist();
                // TODO remove
                return;
            }
            return;
        }
        const thread = threadResponse.thread;
        if (thread == null) {
            (0, logMessage_1.logMessage)(`Thread ${await this.getLinkableId()} deleted, ignoring.`);
            return;
        }
        if (!thread.isTextBased()) {
            return;
        }
        if ((0, GetEnv_1.getEnv)('IGNORE_INIT') === 'true') {
            return;
        }
        let newMessagesCollection;
        if (this.lastDiscordMessageId == null) {
            newMessagesCollection = await thread.messages.fetch({
                limit: 20,
            });
        }
        else {
            newMessagesCollection = await thread.messages.fetch({
                after: this.lastDiscordMessageId,
            });
        }
        const newMessages = Array.from(newMessagesCollection.values());
        newMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
        (0, logMessage_1.logMessage)(`${await this.getLinkableId()} new messages: ${newMessages.length}.`);
        if (newMessages.length === 0) {
            console.log('No new messages, ignoring.');
            return;
        }
        await Promise.all(newMessages.map(newMessage => newMessage.fetch()));
        let lastRelevantMessage = null;
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
                (0, logMessage_1.logMessage)(`Found message for ${await this.getLinkableId()}`, lastRelevantMessage.content);
                if (!messageReceivedInThread_1.messageReceivedInThread[this.threadId]) {
                    await (0, TrySendingMessage_1.trySendingMessage)(thread, {
                        content: `[[${(0, getWhimsicalResponse_1.getWhimsicalResponse)(lastRelevantMessage.author.id)}

I will respond to this message now.]]`
                    });
                    this.handlePrompt(lastRelevantMessage.author, thread, lastRelevantMessage.content, lastRelevantMessage)
                        .catch(e => (0, logMessage_1.logMessage)('INITIALIZEThreads', 'failed to handle prompt...', e));
                }
                else {
                    (0, logMessage_1.logMessage)(`A new message is being handled for ${await this.getLinkableId()} already, no need to respond.`);
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
            (0, logMessage_1.logMessage)(`Found message for ${await this.getLinkableId()}`, lastRelevantMessage.content);
            if (!messageReceivedInThread_1.messageReceivedInThread[this.threadId]) {
                await (0, TrySendingMessage_1.trySendingMessage)(thread, {
                    content: `[[${(0, getWhimsicalResponse_1.getWhimsicalResponse)(this.creatorId)}

I will respond to your last prompt now.]]`,
                });
                this.handlePrompt(lastRelevantMessage.author, thread, lastRelevantMessage.content, lastRelevantMessage)
                    .catch(e => (0, logMessage_1.logMessage)('INITIALIZEThreads', 'failed to handle prompt...', e));
            }
            else {
                (0, logMessage_1.logMessage)(`A new message is being handled for ${await this.getLinkableId()} already, no need to respond.`);
            }
        }
        else {
            (0, logMessage_1.logMessage)(`Found no messages from user for thread: ${await this.getLinkableId()}`);
        }
        this.lastDiscordMessageId = newMessages[newMessages.length - 1].id;
        await this.persist();
    }
}
exports.BaseConversation = BaseConversation;
//# sourceMappingURL=BaseConversation.js.map