import { ModelName } from "./ModelInfo";
import { DMChannel, GuildTextBasedChannel, Message } from "discord.js";
import { BaseConversation } from "./BaseConversation";
export declare class ConversationFactory {
    static handleChannelMessage(channelId: string, message: Message<boolean>, currentBotId: string, channel: GuildTextBasedChannel): Promise<void>;
    static handleMessageAndReturnInfo(info: BaseConversation | null, channelId: string, message: Message<boolean>, channel: DMChannel | GuildTextBasedChannel): Promise<BaseConversation>;
    static create(threadId: string, creatorId: string, guildId: string, username: string, model: ModelName): BaseConversation;
}
