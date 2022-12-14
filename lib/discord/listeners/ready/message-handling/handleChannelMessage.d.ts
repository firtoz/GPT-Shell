import { GuildTextBasedChannel, Message } from "discord.js";
export declare function handleChannelMessage(channelId: string, message: Message<boolean>, currentBotId: string, channel: GuildTextBasedChannel): Promise<void>;
