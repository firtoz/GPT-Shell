import {db} from "../database/db";
import {logMessage} from "../utils/logMessage";
import {
    DiscordAPIError,
    DMChannel,
    Guild,
    GuildBasedChannel,
    GuildTextBasedChannel,
    Message,
    TextBasedChannel,
    User
} from "discord.js";
import {discordClient} from "../discord/discordClient";
import {messageReceivedInThread} from "../discord/listeners/ready/message-handling/handleThread";
import {ModelName} from "./ModelInfo";
import {conversationCache} from "./ConversationCache";
import {retrieveConversation} from "./RetrieveConversation";

const THREAD_PREFIX = `THREAD-`;

type GetThreadResponse = {
    success: true,
    thread: GuildBasedChannel;
} | {
    success: false,
    status: number;
    error: any,
};

export abstract class BaseConversation {
    public isDirectMessage: boolean = false;
    protected lastUpdated: number = 0;
    public lastDiscordMessageId: string | null = null;

    protected constructor(public threadId: string, public creatorId: string, public guildId: string) {
    }

    public static getDBKey(threadId: string) {
        return `${THREAD_PREFIX}${threadId}`;
    }


    async persist() {
        conversationCache[this.threadId] = this;
        this.lastUpdated = new Date().getTime();
        await db.set(BaseConversation.getDBKey(this.threadId), this).catch(e => {
            logMessage('failed to persist thread: ', e);
        });
    }


    abstract handlePrompt(
        user: User,
        channel: TextBasedChannel,
        inputValue: string,
        messageToReplyTo?: Message<boolean>,
    ): Promise<void>;

    async tryGetThread(server: Guild): Promise<GetThreadResponse> {
        try {
            const result = await server.channels.fetch(this.threadId);
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
}
