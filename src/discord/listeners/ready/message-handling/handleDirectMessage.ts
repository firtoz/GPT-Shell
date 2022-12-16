import {DMChannel, Message} from "discord.js";
import {ChatGPTConversationVersion0} from "../../../../core/ChatGPTConversationVersion0";
import {BaseConversation} from "../../../../core/BaseConversation";

export async function handleDirectMessage(channelId: string, message: Message<boolean>, currentBotId: string, channel: DMChannel) {
    let info = await ChatGPTConversationVersion0.retrieve(channelId);

    info = await BaseConversation.handleMessageAndReturnInfo(info, channelId, message, channel);

    info.isDirectMessage = true;
    info.lastDiscordMessageId = message.id;
    await info.persist();
}
