"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StartListeningToMessages = void 0;
const discord_js_1 = require("discord.js");
const handleThread_1 = require("./handleThread");
const handleDirectMessage_1 = require("./handleDirectMessage");
const ConversationFactory_1 = require("../../../../core/ConversationFactory");
function StartListeningToMessages(client) {
    const handleNewMessage = async (message) => {
        const currentBotId = client.user.id;
        if (message.author.id === currentBotId) {
            return;
        }
        if (!message.channel) {
            await client.channels.fetch(message.channelId);
        }
        const channel = message.channel;
        if (!channel) {
            console.log('well, no channel');
            return;
        }
        if (channel.isDMBased()) {
            if (message.author.dmChannel === channel) {
                await (0, handleDirectMessage_1.handleDirectMessage)(message.channelId, message, currentBotId, channel);
            }
            return;
        }
        if (!message.inGuild()) {
            // TODO handle DMs
            return;
        }
        const channelId = channel.id;
        if (channelId == null) {
            return;
        }
        if (!channel.isTextBased()) {
            return;
        }
        if (!channel.isThread()) {
            await ConversationFactory_1.ConversationFactory.handleChannelMessage(channelId, message, currentBotId, channel);
            return;
        }
        await (0, handleThread_1.handleThread)(channelId, message, channel);
    };
    console.log('ready to listen to messages...');
    client.on(discord_js_1.Events.MessageCreate, handleNewMessage);
}
exports.StartListeningToMessages = StartListeningToMessages;
//# sourceMappingURL=startListeningToMessages.js.map