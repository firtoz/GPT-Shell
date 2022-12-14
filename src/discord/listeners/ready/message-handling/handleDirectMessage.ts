import {DMChannel, Message} from "discord.js";
import {ChatGPTConversation} from "../../../../core/ChatGPTConversation";
import {handleMessageAndReturnInfo} from "./handleMessageAndReturnInfo";

export async function handleDirectMessage(channelId: string, message: Message<boolean>, currentBotId: string, channel: DMChannel) {
    let info = await ChatGPTConversation.retrieve(channelId);

    info = await handleMessageAndReturnInfo(info, channelId, message, channel);

    info.isDirectMessage = true;
    info.lastDiscordMessageId = message.id;
    await info.persist();
}
