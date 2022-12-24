import { Message, TextBasedChannel, User } from "discord.js";
import { ModelName } from "./ModelInfo";
import { BaseConversation } from "./BaseConversation";
export declare class ChatGPTConversationVersion0 extends BaseConversation {
    username: string;
    model: ModelName;
    lastUpdated: number;
    lastDiscordMessageId: string | null;
    allHistory: string;
    numPrompts: number;
    currentHistory: string;
    isDirectMessage: boolean;
    constructor(threadId: string, creatorId: string, guildId: string, username: string, model: ModelName);
    static handleRetrievalFromDB(fromDb: ChatGPTConversationVersion0): Promise<ChatGPTConversationVersion0>;
    private SendPromptToGPTChat;
    handlePrompt(user: User, channel: TextBasedChannel, inputValue: string, messageToReplyTo?: Message<boolean>): Promise<void>;
    private getDebugName;
    static initialiseAll(): Promise<void>;
}
