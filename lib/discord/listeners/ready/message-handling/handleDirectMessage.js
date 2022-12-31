"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleDirectMessage = void 0;
const RetrieveConversation_1 = require("../../../../core/RetrieveConversation");
const ConversationFactory_1 = require("../../../../core/ConversationFactory");
async function handleDirectMessage(channelId, message, currentBotId, channel) {
    let info = await (0, RetrieveConversation_1.retrieveConversation)(channelId);
    info = await ConversationFactory_1.ConversationFactory.handleMessageAndReturnConversation(info, channelId, message, channel);
    info.isDirectMessage = true;
    info.lastDiscordMessageId = message.id;
    await info.persist();
}
exports.handleDirectMessage = handleDirectMessage;
//# sourceMappingURL=handleDirectMessage.js.map