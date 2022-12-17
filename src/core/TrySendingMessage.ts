import {BaseMessageOptions, Message, TextBasedChannel} from "discord.js";
import {logMessage} from "../utils/logMessage";

export async function trySendingMessage(channel: TextBasedChannel, response: BaseMessageOptions, messageToReplyTo?: Message<boolean> | undefined) {
    try {
        if (messageToReplyTo != null) {
            return await messageToReplyTo.reply(response);
        } else {
            return await channel.send(response);
        }
    } catch (e) {
        logMessage(`Cannot send a message: [${channel.isDMBased() ? 'DM' : channel.guild?.name ?? channel.guildId}] <#${channel.id}>`, e)
    }
}
