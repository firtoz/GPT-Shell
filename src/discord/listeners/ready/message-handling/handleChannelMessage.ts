import {GuildTextBasedChannel, Message} from "discord.js";
import {ChatGPTConversation} from "../../../../core/ChatGPTConversation";
import {handleMessageAndReturnInfo} from "./handleMessageAndReturnInfo";

export async function handleChannelMessage(channelId: string, message: Message<boolean>, currentBotId: string, channel: GuildTextBasedChannel) {
    let info = await ChatGPTConversation.retrieve(channelId);

    if (message.mentions.users.has(currentBotId)) {
        info = await handleMessageAndReturnInfo(info, channelId, message, channel);
        info.guildId = channel.guildId;
        info.lastDiscordMessageId = message.id;

        await info.persist();
    } else {
        if (info != null) {
            info.lastDiscordMessageId = message.id;
            await info.persist();
        }
    }
}
