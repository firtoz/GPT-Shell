import { Guild, GuildBasedChannel, Message, TextBasedChannel, User } from "discord.js";
type GetThreadResponse = {
    success: true;
    thread: GuildBasedChannel;
} | {
    success: false;
    status: number;
    error: any;
};
export declare abstract class BaseConversation {
    threadId: string;
    creatorId: string;
    guildId: string;
    isDirectMessage: boolean;
    protected lastUpdated: number;
    lastDiscordMessageId: string | null;
    deleted: boolean;
    protected constructor(threadId: string, creatorId: string, guildId: string);
    static getDBKey(threadId: string): string;
    persist(): Promise<void>;
    abstract handlePrompt(user: User, channel: TextBasedChannel, inputValue: string, messageToReplyTo?: Message<boolean>): Promise<void>;
    tryGetThread(server: Guild): Promise<GetThreadResponse>;
    static TryGetThread(server: Guild, threadId: string): Promise<GetThreadResponse>;
    getLinkableId(): Promise<string>;
    protected static GetLinkableId(conversation: BaseConversation): Promise<string>;
    initialise(): Promise<void>;
}
export {};
