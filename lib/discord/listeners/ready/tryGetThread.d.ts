import { Guild, GuildBasedChannel } from "discord.js";
import { ChatGPTConversation } from "../../../core/ChatGPTConversation";
type GetThreadResponse = {
    success: true;
    thread: GuildBasedChannel;
} | {
    success: false;
    status: number;
    error: any;
};
export declare function tryGetThread(server: Guild, info: ChatGPTConversation): Promise<GetThreadResponse>;
export {};
