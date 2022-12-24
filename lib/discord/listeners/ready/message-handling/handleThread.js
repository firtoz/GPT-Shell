"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleThread = exports.messageReceivedInThread = void 0;
const RetrieveConversation_1 = require("../../../../core/RetrieveConversation");
exports.messageReceivedInThread = {};
async function handleThread(channelId, message, channel) {
    const info = await (0, RetrieveConversation_1.retrieveConversation)(channelId);
    if (info === null) {
        return;
    }
    if (info.creatorId === message.author.id) {
        exports.messageReceivedInThread[info.threadId] = true;
        await info.handlePrompt(message.author, channel, message.content, message);
    }
    info.lastDiscordMessageId = message.id;
    info.guildId = channel.guildId;
    await info.persist();
}
exports.handleThread = handleThread;
//# sourceMappingURL=handleThread.js.map