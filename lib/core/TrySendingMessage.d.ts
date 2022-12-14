import { BaseMessageOptions, Message, TextBasedChannel } from "discord.js";
export declare function trySendingMessage(channel: TextBasedChannel, response: BaseMessageOptions, messageToReplyTo?: Message<boolean> | undefined): Promise<Message<boolean> | undefined>;
