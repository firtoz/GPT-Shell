import {DiscordAPIError, Guild, GuildBasedChannel} from "discord.js";
import {ChatGPTConversation} from "../../../core/ChatGPTConversation";
import {logMessage} from "../../../utils/logMessage";

type GetThreadResponse = {
    success: true,
    thread: GuildBasedChannel;
} | {
    success: false,
    status: number;
    error: any,
};

export async function tryGetThread(server: Guild, info: ChatGPTConversation): Promise<GetThreadResponse> {
    try {
        const result = await server.channels.fetch(info.threadId);
        if (result == null) {
            return {
                success: false,
                status: -1,
                error: new Error('...'),
            };
        }

        return {
            success: true,
            thread: result,
        };
    } catch (e) {
        if (e instanceof DiscordAPIError) {
            switch (e.status) {
                case 404:
                    return {
                        success: false,
                        status: 404,
                        error: e,
                    };
                default:
                    break;
            }

            logMessage('INITIALIZEThreads', e.status);

            return {
                success: false,
                status: e.status,
                error: e,
            }
        }

        logMessage('INITIALIZEThreads', e);

        return {
            success: false,
            status: -1,
            error: e,
        };
    }
}
