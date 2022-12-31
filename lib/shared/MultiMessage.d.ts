import { Message, TextBasedChannel } from "discord.js";
export declare class MultiMessage {
    private channel;
    private messageToReplyTo?;
    readonly messageList: {
        finished: boolean;
        cached: string;
        message: Message<boolean>;
    }[];
    isLogMessage: boolean;
    constructor(channel: TextBasedChannel, firstMessage?: Message<boolean>, messageToReplyTo?: Message<boolean> | undefined);
    update(message: string, finished: boolean, error?: boolean): Promise<void>;
    private updateMessages;
}
