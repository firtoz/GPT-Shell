import { Message, TextBasedChannel, User } from "discord.js";
import { ModelName } from "./ModelInfo";
import { BaseConversation } from "./BaseConversation";
import './compute-cosine-similarity';
import { ChatGPTConversationVersion0 } from "./ChatGPTConversationVersion0";
import { MessageHistoryItem } from "./MessageHistoryItem";
export declare const messageToPromptPart: (item: MessageHistoryItem) => string;
export declare class ChatGPTConversation extends BaseConversation {
    private username;
    private model;
    static latestVersion: number;
    messageHistory: MessageHistoryItem[];
    version: number;
    private makeEmbeddings;
    constructor(threadId: string, creatorId: string, guildId: string, username: string, model: ModelName);
    static handleRetrievalFromDB(fromDb: ChatGPTConversation): Promise<ChatGPTConversation>;
    private SendPromptToGPTChat;
    handlePrompt(user: User, channel: TextBasedChannel, inputValue: string, messageToReplyTo?: Message<boolean>): Promise<void>;
    private getDebugName;
    static initialiseAll(): Promise<void>;
    static upgrade(fromDb: ChatGPTConversationVersion0): Promise<ChatGPTConversation | null>;
}
