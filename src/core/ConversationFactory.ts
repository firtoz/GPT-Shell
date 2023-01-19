import {retrieveConversation} from "./RetrieveConversation";
import {discordClient} from "../discord/discordClient";
import {ModelName} from "./ModelInfo";
import {DMChannel, GuildTextBasedChannel, Message} from "discord.js";
import {BaseConversation} from "./BaseConversation";
import {ChatGPTConversation} from "./ChatGPTConversation";
import {messageReceivedInThread} from "../discord/listeners/ready/message-handling/messageReceivedInThread";
import {getConfigForId} from "./config";

export class ConversationFactory {

    static async handleChannelMessage(channelId: string, message: Message<boolean>, currentBotId: string, channel: GuildTextBasedChannel) {
        let conversation = await retrieveConversation(channelId);

        const configId = channel.guildId;
        const config = await getConfigForId(configId);
        if (config.chatChannelIds.includes(channelId)) {
            conversation = await ConversationFactory.handleMessageAndReturnConversation(conversation, channelId, message, channel);

            await conversation.persist();

            return;
        }

        if (message.mentions.users.has(currentBotId)) {
            conversation = await ConversationFactory.handleMessageAndReturnConversation(conversation, channelId, message, channel);
            conversation.lastDiscordMessageId = message.id;

            await conversation.persist();
        } else {
            if (conversation != null) {
                conversation.lastDiscordMessageId = message.id;
                await conversation.persist();
            }
        }
    }

    static async handleMessageAndReturnConversation(
        conversation: BaseConversation | null,
        channelId: string,
        message: Message<boolean>,
        channel: DMChannel | GuildTextBasedChannel
    ): Promise<BaseConversation> {
        if (conversation === null) {
            conversation = new ChatGPTConversation(channelId,
                message.author.id,
                message.guildId ?? '',
                discordClient.user!.username,
                'text-davinci-003'
            );

            if (channel.isDMBased()) {
                conversation.isDirectMessage = true;
            }

            await conversation.persist();
        }

        messageReceivedInThread[conversation.threadId] = true;
        conversation.lastDiscordMessageId = message.id;
        await conversation.handlePrompt(
            message.author,
            channel,
            message.content,
            message,
        );
        return conversation;
    }

    static create(
        threadId: string,
        creatorId: string,
        guildId: string,
        username: string,
        model: ModelName,
    ): ChatGPTConversation {
        return new ChatGPTConversation(threadId, creatorId, guildId, username, model);
    }
}
