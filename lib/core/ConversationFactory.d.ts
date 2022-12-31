import { ModelName } from "./ModelInfo";
import { DMChannel, GuildTextBasedChannel, Message } from "discord.js";
import { BaseConversation } from "./BaseConversation";
import { ChatGPTConversation } from "./ChatGPTConversation";
export declare class ConversationFactory {
    static handleChannelMessage(channelId: string, message: Message<boolean>, currentBotId: string, channel: GuildTextBasedChannel): Promise<void>;
    static handleMessageAndReturnConversation(conversation: BaseConversation | null, channelId: string, message: Message<boolean>, channel: DMChannel | GuildTextBasedChannel): Promise<BaseConversation>;
    static create(threadId: string, creatorId: string, guildId: string, username: string, model: ModelName): ChatGPTConversation;
}
