"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConversationFactory = void 0;
const RetrieveConversation_1 = require("./RetrieveConversation");
const discordClient_1 = require("../discord/discordClient");
const handleThread_1 = require("../discord/listeners/ready/message-handling/handleThread");
const ChatGPTConversation_1 = require("./ChatGPTConversation");
class ConversationFactory {
    static async handleChannelMessage(channelId, message, currentBotId, channel) {
        let conversation = await (0, RetrieveConversation_1.retrieveConversation)(channelId);
        if (message.mentions.users.has(currentBotId)) {
            conversation = await ConversationFactory.handleMessageAndReturnInfo(conversation, channelId, message, channel);
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
    static async handleMessageAndReturnInfo(info, channelId, message, channel) {
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
    static create(threadId, creatorId, guildId, username, model) {
        return new ChatGPTConversation_1.ChatGPTConversation(threadId, creatorId, guildId, username, model);
    }
}
exports.ConversationFactory = ConversationFactory;
//# sourceMappingURL=ConversationFactory.js.map