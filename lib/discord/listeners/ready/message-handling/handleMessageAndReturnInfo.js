"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleMessageAndReturnInfo = void 0;
const ChatGPTConversation_1 = require("../../../../core/ChatGPTConversation");
const discordClient_1 = require("../../../discordClient");
const handleThread_1 = require("./handleThread");
async function handleMessageAndReturnInfo(info, channelId, message, channel) {
    if (info === null) {
        info = new ChatGPTConversation_1.ChatGPTConversation(channelId, message.author.id, message.guildId ?? '', discordClient_1.discordClient.user.username, 'text-davinci-003');
        if (channel.isDMBased()) {
            info.isDirectMessage = true;
        }
        await info.persist();
    }
    handleThread_1.messageReceivedInThread[info.threadId] = true;
    await info.handlePrompt(message.author, channel, message.content, message);
    info.lastDiscordMessageId = message.id;
    return info;
}
exports.handleMessageAndReturnInfo = handleMessageAndReturnInfo;
//# sourceMappingURL=handleMessageAndReturnInfo.js.map