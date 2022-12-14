import {AnyThreadChannel, Message} from "discord.js";
import {ChatGPTConversation} from "../../../../core/ChatGPTConversation";

export const messageReceivedInThread: Record<string, undefined | true> = {};

export async function handleThread(
    channelId: string,
    message: Message<boolean>,
    channel: AnyThreadChannel<true>
) {
    const info = await ChatGPTConversation.retrieve(channelId);
    if (info === null) {
        return;
    }

    if (info.creatorId === message.author.id) {
        messageReceivedInThread[info.threadId] = true;
        await info.handlePrompt(message.author, channel, message.content, message);
    }

    info.lastDiscordMessageId = message.id;
    info.guildId = channel.guildId;

    await info.persist();
}
