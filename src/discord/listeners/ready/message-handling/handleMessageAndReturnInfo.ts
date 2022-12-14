import {ChatGPTConversation} from "../../../../core/ChatGPTConversation";
import {DMChannel, GuildTextBasedChannel, Message} from "discord.js";
import {discordClient} from "../../../discordClient";
import {messageReceivedInThread} from "./handleThread";

export async function handleMessageAndReturnInfo(info: ChatGPTConversation | null, channelId: string, message: Message<boolean>, channel: DMChannel | GuildTextBasedChannel) {
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
