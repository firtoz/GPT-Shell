import { Message, TextBasedChannel, User } from "discord.js";
import { ModelName } from "./ModelInfo";
export declare class ChatGPTConversation {
    threadId: string;
    creatorId: string;
    guildId: string;
    private username;
    private model;
    lastUpdated: number;
    lastDiscordMessageId: string | null;
    deleted: boolean;
    allHistory: string;
    numPrompts: number;
    currentHistory: string;
    isDirectMessage: boolean;
    constructor(threadId: string, creatorId: string, guildId: string, username: string, model: ModelName);
    persist(): Promise<void>;
    private static getDBKey;
    static retrieve(threadId: string): Promise<ChatGPTConversation | null>;
    private static handleRetrievalFromDB;
    private SendPromptToGPTChat;
    handlePrompt(user: User, channel: TextBasedChannel, inputValue: string, messageToReplyTo?: Message<boolean>): Promise<void>;
    static initialise(callback: (info: ChatGPTConversation) => Promise<void>): Promise<void>;
}
