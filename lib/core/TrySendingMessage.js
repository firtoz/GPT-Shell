"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trySendingMessage = void 0;
const logMessage_1 = require("../utils/logMessage");
async function trySendingMessage(channel, response, messageToReplyTo) {
    try {
        if (messageToReplyTo != null) {
            return await messageToReplyTo.reply(response);
        }
        else {
            return await channel.send(response);
        }
    }
    catch (e) {
        (0, logMessage_1.logMessage)(`Cannot send a message: [${channel.isDMBased() ? 'DM' : channel.guild?.name ?? channel.guildId}] <#${channel.id}>`, e);
    }
}
exports.trySendingMessage = trySendingMessage;
//# sourceMappingURL=TrySendingMessage.js.map