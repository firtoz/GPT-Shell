import { AnyThreadChannel, Message } from "discord.js";
export declare const messageReceivedInThread: Record<string, undefined | true>;
export declare function handleThread(channelId: string, message: Message<boolean>, channel: AnyThreadChannel<true>): Promise<void>;
