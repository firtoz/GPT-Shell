import { AnyThreadChannel, Message } from "discord.js";
export declare function handleThread(channelId: string, message: Message<boolean>, channel: AnyThreadChannel<true>): Promise<void>;
