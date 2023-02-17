"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleThread = void 0;
const RetrieveConversation_1 = require("../../../../core/RetrieveConversation");
const messageReceivedInThread_1 = require("./messageReceivedInThread");
const ChatGPTConversation_1 = require("../../../../core/ChatGPTConversation");
async function handleThread(channelId, message, channel) {
    if ((0, ChatGPTConversation_1.ignoreInput)(message.content)) {
        return;
    }
    const info = await (0, RetrieveConversation_1.retrieveConversation)(channelId);
    if (info === null) {
        return;
    }
    if (info.creatorId === message.author.id) {
        messageReceivedInThread_1.messageReceivedInThread[info.threadId] = true;
        await info.handlePrompt(message.author, channel, message.content, message);
    }
    else {
        if (info.allowExternals) {
            await info.handlePrompt(message.author, channel, message.content, message);
        }
        else if (!info.shownAllowExternalsInfo) {
            info.shownAllowExternalsInfo = true;
            await info.sendReply(channel, `<@${info.creatorId}>: If you'd like others to be able to chat in this thread, ` +
                `please type exactly \`<TOGGLE_EXTERNALS>\` in this thread. This message will be shown only once.`);
        }
    }
    info.lastDiscordMessageId = message.id;
    info.guildId = channel.guildId;
    await info.persist();
}
exports.handleThread = handleThread;
//# sourceMappingURL=handleThread.js.map