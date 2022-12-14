import { ChatGPTConversation } from "../../../../core/ChatGPTConversation";
import { DMChannel, GuildTextBasedChannel, Message } from "discord.js";
export declare function handleMessageAndReturnInfo(info: ChatGPTConversation | null, channelId: string, message: Message<boolean>, channel: DMChannel | GuildTextBasedChannel): Promise<ChatGPTConversation>;
