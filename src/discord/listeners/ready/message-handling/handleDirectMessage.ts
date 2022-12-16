import {DMChannel, Message} from "discord.js";
import {BaseConversation} from "../../../../core/BaseConversation";

export async function handleDirectMessage(channelId: string, message: Message<boolean>, currentBotId: string, channel: DMChannel) {
    let info = await BaseConversation.retrieve(channelId);

    info = await BaseConversation.handleMessageAndReturnInfo(info, channelId, message, channel);

    info.isDirectMessage = true;
    info.lastDiscordMessageId = message.id;
    await info.persist();
}
