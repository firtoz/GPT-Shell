import { DMChannel, Message } from "discord.js";
export declare function handleDirectMessage(channelId: string, message: Message<boolean>, currentBotId: string, channel: DMChannel): Promise<void>;
