"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleChannelMessage = void 0;
const ChatGPTConversation_1 = require("../../../../core/ChatGPTConversation");
const handleMessageAndReturnInfo_1 = require("./handleMessageAndReturnInfo");
async function handleChannelMessage(channelId, message, currentBotId, channel) {
    let info = await ChatGPTConversation_1.ChatGPTConversation.retrieve(channelId);
    if (message.mentions.users.has(currentBotId)) {
        info = await (0, handleMessageAndReturnInfo_1.handleMessageAndReturnInfo)(info, channelId, message, channel);
        info.guildId = channel.guildId;
        info.lastDiscordMessageId = message.id;
        await info.persist();
    }
    else {
        if (info != null) {
            info.lastDiscordMessageId = message.id;
            await info.persist();
        }
    }
}
exports.handleChannelMessage = handleChannelMessage;
//# sourceMappingURL=handleChannelMessage.js.map