import {AnyThreadChannel, Message} from "discord.js";
import {retrieveConversation} from "../../../../core/RetrieveConversation";
import {messageReceivedInThread} from "./messageReceivedInThread";
import {ChatGPTConversation, ignoreInput} from "../../../../core/ChatGPTConversation";

export async function handleThread(
    channelId: string,
    message: Message<boolean>,
    channel: AnyThreadChannel<true>
) {
    if (ignoreInput(message.content)) {
        return;
    }

    const info = await retrieveConversation(channelId) as ChatGPTConversation;

    if (info === null) {
        return;
    }

    if (info.creatorId === message.author.id) {
        messageReceivedInThread[info.threadId] = true;
        await info.handlePrompt(message.author, channel, message.content, message);
    } else {
        if (info.allowExternals) {
            await info.handlePrompt(message.author, channel, message.content, message);
        } else if (!info.shownAllowExternalsInfo) {
            info.shownAllowExternalsInfo = true;
            await info.sendReply(channel, `<@${info.creatorId}>: If you'd like others to be able to chat in this thread, ` +
                `please type exactly \`<TOGGLE_EXTERNALS>\` in this thread. This message will be shown only once.`);
        }
    }

    info.lastDiscordMessageId = message.id;
    info.guildId = channel.guildId;

    await info.persist();
}
