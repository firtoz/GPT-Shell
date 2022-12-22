import {DMChannel, Message} from "discord.js";
import {retrieveConversation} from "../../../../core/RetrieveConversation";
import {ConversationFactory} from "../../../../core/ConversationFactory";

export async function handleDirectMessage(channelId: string, message: Message<boolean>, currentBotId: string, channel: DMChannel) {
    let info = await retrieveConversation(channelId);

    info = await ConversationFactory.handleMessageAndReturnInfo(info, channelId, message, channel);

    info.isDirectMessage = true;
    info.lastDiscordMessageId = message.id;
    await info.persist();
}
