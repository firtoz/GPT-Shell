"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationFactory = void 0;
const RetrieveConversation_1 = require("./RetrieveConversation");
const discordClient_1 = require("../discord/discordClient");
const ChatGPTConversation_1 = require("./ChatGPTConversation");
const messageReceivedInThread_1 = require("../discord/listeners/ready/message-handling/messageReceivedInThread");
const config_1 = require("./config");
class ConversationFactory {
    static async handleChannelMessage(channelId, message, currentBotId, channel) {
        let conversation = await (0, RetrieveConversation_1.retrieveConversation)(channelId);
        const configId = channel.guildId;
        const config = await (0, config_1.getConfigForId)(configId);
        if (config.chatChannelIds.includes(channelId)) {
            conversation = await ConversationFactory.handleMessageAndReturnConversation(conversation, channelId, message, channel);
            await conversation.persist();
            return;
        }
        if (message.mentions.users.has(currentBotId)) {
            conversation = await ConversationFactory.handleMessageAndReturnConversation(conversation, channelId, message, channel);
            conversation.lastDiscordMessageId = message.id;
            await conversation.persist();
        }
        else {
            if (conversation != null) {
                conversation.lastDiscordMessageId = message.id;
                await conversation.persist();
            }
        }
    }
    static async handleMessageAndReturnConversation(conversation, channelId, message, channel) {
        if (conversation === null) {
            conversation = new ChatGPTConversation_1.ChatGPTConversation(channelId, message.author.id, message.guildId ?? '', discordClient_1.discordClient.user.username, 'text-davinci-003');
            if (channel.isDMBased()) {
                conversation.isDirectMessage = true;
            }
            await conversation.persist();
        }
        messageReceivedInThread_1.messageReceivedInThread[conversation.threadId] = true;
        conversation.lastDiscordMessageId = message.id;
        await conversation.handlePrompt(message.author, channel, message.content, message);
        return conversation;
    }
    static create(threadId, creatorId, guildId, username, model) {
        return new ChatGPTConversation_1.ChatGPTConversation(threadId, creatorId, guildId, username, model);
    }
}
exports.ConversationFactory = ConversationFactory;
//# sourceMappingURL=ConversationFactory.js.map