import {retrieveConversation} from "./RetrieveConversation";
import {discordClient} from "../discord/discordClient";
import {messageReceivedInThread} from "../discord/listeners/ready/message-handling/handleThread";
import {ModelName} from "./ModelInfo";
import {DMChannel, GuildTextBasedChannel, Message} from "discord.js";
import {BaseConversation} from "./BaseConversation";
import {ChatGPTConversation} from "./ChatGPTConversation";

export class ConversationFactory {

    static async handleChannelMessage(channelId: string, message: Message<boolean>, currentBotId: string, channel: GuildTextBasedChannel) {
        let conversation = await retrieveConversation(channelId);

        if (message.mentions.users.has(currentBotId)) {
            conversation = await ConversationFactory.handleMessageAndReturnInfo(conversation, channelId, message, channel);
            conversation.lastDiscordMessageId = message.id;

            await conversation.persist();
        } else {
            if (conversation != null) {
                conversation.lastDiscordMessageId = message.id;
                await conversation.persist();
            }
        }
    }

    static async handleMessageAndReturnInfo(
        info: BaseConversation | null,
        channelId: string,
        message: Message<boolean>,
        channel: DMChannel | GuildTextBasedChannel
    ): Promise<BaseConversation> {
        if (info === null) {
            info = new ChatGPTConversation(channelId,
                message.author.id,
                message.guildId ?? '',
                discordClient.user!.username,
                'text-davinci-003'
            );

            if (channel.isDMBased()) {
                info.isDirectMessage = true;
            }

            await info.persist();
        }

        messageReceivedInThread[info.threadId] = true;
        await info.handlePrompt(
            message.author,
            channel,
            message.content,
            message,
        );
        info.lastDiscordMessageId = message.id;
        return info;
    }

    static create(
        threadId: string,
        creatorId: string,
        guildId: string,
        username: string,
        model: ModelName,
    ): BaseConversation {
        return new ChatGPTConversation(threadId, creatorId, guildId, username, model);
    }
}
