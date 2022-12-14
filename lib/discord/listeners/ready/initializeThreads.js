"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InitializeThreads = void 0;
const ChatGPTConversation_1 = require("../../../core/ChatGPTConversation");
const logMessage_1 = require("../../../utils/logMessage");
const getWhimsicalResponse_1 = require("./getWhimsicalResponse");
const tryGetThread_1 = require("./tryGetThread");
const handleThread_1 = require("./message-handling/handleThread");
function InitializeThreads(client) {
    const currentBotId = client.user.id;
    ChatGPTConversation_1.ChatGPTConversation.initialise(async (info) => {
        (0, logMessage_1.logMessage)(`Initialising thread: <#${info.threadId}>.`);
        if (info.isDirectMessage) {
            const channel = await client.channels.fetch(info.threadId);
            if (!channel) {
                return;
            }
            if (!channel.isDMBased()) {
                return;
            }
            if (!channel.isTextBased()) {
                return;
            }
            const user = await client.users.fetch(info.creatorId);
            if (!user) {
                // cannot find user
                return;
            }
            let newMessagesCollection;
            if (info.lastDiscordMessageId == null) {
                newMessagesCollection = await channel.messages.fetch({
                    limit: 20,
                });
            }
            else {
                newMessagesCollection = await channel.messages.fetch({
                    after: info.lastDiscordMessageId,
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
            channel.send(`[[${(0, getWhimsicalResponse_1.getWhimsicalResponse)(user.id)}

I will respond to this message now.]]`);
            info.handlePrompt(lastMessage.author, channel, lastMessage.content, lastMessage)
                .catch(e => (0, logMessage_1.logMessage)('INITIALIZEThreads', 'failed to handle prompt...', e));
            return;
        }
        if (info.guildId === null) {
            (0, logMessage_1.logMessage)('no guild for info: ', info);
            const guilds = Array.from(client.guilds.cache.values());
            for (const server of guilds) {
                const channel = await server.channels.fetch(info.threadId);
                if (channel != null) {
                    (0, logMessage_1.logMessage)('found guild for info: ', info, server.id);
                    info.guildId = server.id;
                    await info.persist();
                }
            }
        }
        const server = client.guilds.cache.get(info.guildId);
        if (server == null) {
            (0, logMessage_1.logMessage)('INITIALIZEThreads', 'server null for info', info);
            return;
        }
        const threadResponse = await (0, tryGetThread_1.tryGetThread)(server, info);
        if (!threadResponse.success) {
            (0, logMessage_1.logMessage)(`${info.threadId} <#${info.threadId}>: Failed to get thread, status: ${threadResponse.status}`);
            if (threadResponse.status === 404) {
                (0, logMessage_1.logMessage)(`Thread ${info.threadId} <#${info.threadId}> deleted (or never existed)! Marking as deleted...`);
                info.deleted = true;
                await info.persist();
                // TODO remove
                return;
            }
            return;
        }
        const thread = threadResponse.thread;
        if (thread == null) {
            (0, logMessage_1.logMessage)(`Thread <#${info.threadId}> deleted, ignoring.`);
            return;
        }
        if (!thread.isTextBased()) {
            return;
        }
        let newMessagesCollection;
        if (info.lastDiscordMessageId == null) {
            newMessagesCollection = await thread.messages.fetch({
                limit: 20,
            });
        }
        else {
            newMessagesCollection = await thread.messages.fetch({
                after: info.lastDiscordMessageId,
            });
        }
        const newMessages = Array.from(newMessagesCollection.values());
        newMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);
        (0, logMessage_1.logMessage)(`Thread [${thread.guild.name}] <#${info.threadId}> new messages: ${newMessages.length}.`);
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
            info.lastDiscordMessageId = newMessages[newMessages.length - 1].id;
            if (lastRelevantMessage != null) {
                (0, logMessage_1.logMessage)(`Found message for thread: <#${info.threadId}>`, lastRelevantMessage.content);
                if (!handleThread_1.messageReceivedInThread[info.threadId]) {
                    thread.send(`[[${(0, getWhimsicalResponse_1.getWhimsicalResponse)(lastRelevantMessage.author.id)}

I will respond to this message now.]]`);
                    info.handlePrompt(lastRelevantMessage.author, thread, lastRelevantMessage.content, lastRelevantMessage)
                        .catch(e => (0, logMessage_1.logMessage)('INITIALIZEThreads', 'failed to handle prompt...', e));
                }
                else {
                    (0, logMessage_1.logMessage)(`A new message is being handled for <#${info.threadId}> already, no need to respond.`);
                }
            }
            await info.persist();
            return;
        }
        for (let newMessage of newMessages) {
            if (newMessage.author.id === info.creatorId) {
                lastRelevantMessage = newMessage;
            }
        }
        if (lastRelevantMessage != null) {
            (0, logMessage_1.logMessage)(`Found message for thread: <#${info.threadId}>`, lastRelevantMessage.content);
            if (!handleThread_1.messageReceivedInThread[info.threadId]) {
                thread.send(`[[${(0, getWhimsicalResponse_1.getWhimsicalResponse)(info.creatorId)}

I will respond to your last prompt now.]]`);
                info.handlePrompt(lastRelevantMessage.author, thread, lastRelevantMessage.content, lastRelevantMessage)
                    .catch(e => (0, logMessage_1.logMessage)('INITIALIZEThreads', 'failed to handle prompt...', e));
            }
            else {
                (0, logMessage_1.logMessage)(`A new message is being handled for <#${info.threadId}> already, no need to respond.`);
            }
        }
        else {
            (0, logMessage_1.logMessage)(`Found no messages from user for thread: <#${info.threadId}>`);
        }
        info.lastDiscordMessageId = newMessages[newMessages.length - 1].id;
        await info.persist();
    }).catch(e => {
        (0, logMessage_1.logMessage)('INITIALIZEThreads', 'Initialise error...');
    });
}
exports.InitializeThreads = InitializeThreads;
//# sourceMappingURL=initializeThreads.js.map