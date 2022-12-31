import { Message, TextBasedChannel, User } from "discord.js";
import { OpenAIApi } from 'openai';
import { ModelName } from "./ModelInfo";
import { BaseConversation } from "./BaseConversation";
import { MessageHistoryItem } from "./MessageHistoryItem";
export declare const messageToPromptPart: (item: MessageHistoryItem) => string;
export declare class ChatGPTConversation extends BaseConversation {
    username: string;
    private model;
    static latestVersion: number;
    messageHistory: string[];
    messageHistoryMap: Record<string, MessageHistoryItem>;
    nextEmbedCheck: number;
    customPrompt: string | null;
    temperature: number;
    summary: string;
    nextSummaryMessageCount: number;
    version: number;
    constructor(threadId: string, creatorId: string, guildId: string, username: string, model: ModelName);
    static handleRetrievalFromDB(fromDb: ChatGPTConversation): Promise<ChatGPTConversation>;
    createHumanMessage(openai: OpenAIApi, user: User, message: string): Promise<MessageHistoryItem>;
    createResponseMessage(openai: OpenAIApi, botUsername: string, user: User, message: string): Promise<{
        type: "response";
    } & {
        id: string;
        timestamp: number | undefined;
        username: string;
        content: string;
        numTokens: number;
        embedding: string | null;
    }>;
    private tryCreateEmbeddingForMessage;
    private SendPromptToGPTChat;
    handlePrompt(user: User, channel: TextBasedChannel, inputValue: string, messageToReplyTo?: Message<boolean>): Promise<void>;
    deleteMessages(toDelete: number): Promise<string[]>;
    private tryEmbedMany;
    private testQuery;
    private getFullPrompt;
    private getRelevantMessages;
    private sendReply;
    private getDebugName;
    static initialiseAll(): Promise<void>;
}
