"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleDirectMessage = void 0;
const ChatGPTConversation_1 = require("../../../../core/ChatGPTConversation");
const handleMessageAndReturnInfo_1 = require("./handleMessageAndReturnInfo");
async function handleDirectMessage(channelId, message, currentBotId, channel) {
    let info = await ChatGPTConversation_1.ChatGPTConversation.retrieve(channelId);
    info = await (0, handleMessageAndReturnInfo_1.handleMessageAndReturnInfo)(info, channelId, message, channel);
    info.isDirectMessage = true;
    info.lastDiscordMessageId = message.id;
    await info.persist();
}
exports.handleDirectMessage = handleDirectMessage;
//# sourceMappingURL=handleDirectMessage.js.map