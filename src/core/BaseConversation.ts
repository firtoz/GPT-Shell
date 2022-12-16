import {db} from "../database/db";
import {logMessage} from "../utils/logMessage";
import {ChatGPTConversation} from "./ChatGPTConversation";
import {ChatGPTConversationVersion0} from "./ChatGPTConversationVersion0";
import {
    DiscordAPIError, DMChannel,
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

const THREAD_PREFIX = `THREAD-`;

const cache: Record<string, BaseConversation | undefined | null> = {};

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

    constructor(public threadId: string) {
    }

    public static getDBKey(threadId: string) {
        return `${THREAD_PREFIX}${threadId}`;
    }


    async persist() {
        cache[this.threadId] = this;
        this.lastUpdated = new Date().getTime();
        await db.set(BaseConversation.getDBKey(this.threadId), this).catch(e => {
            logMessage('failed to persist thread: ', e);
        });
    }

    static async retrieve(threadId: string): Promise<BaseConversation | null> {
        const inCache = cache[threadId];
        if (inCache !== undefined) {
            // either null or exists
            // if null, not our thread
            return inCache;
        }

        const fromDb = await db.get<BaseConversation>(ChatGPTConversation.getDBKey(threadId));

        let result: BaseConversation | null = null;

        if (fromDb != null) {
            if ((fromDb as ChatGPTConversation).version !== undefined) {
                result = await ChatGPTConversation.handleRetrievalFromDB(fromDb as ChatGPTConversation);
            }

            result = await ChatGPTConversationVersion0.handleRetrievalFromDB(fromDb as ChatGPTConversationVersion0);
        }

        cache[threadId] = result;

        return null;
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

    static async handleChannelMessage(channelId: string, message: Message<boolean>, currentBotId: string, channel: GuildTextBasedChannel) {
        let conversation = await BaseConversation.retrieve(channelId);

        if (message.mentions.users.has(currentBotId)) {
            conversation = await BaseConversation.handleMessageAndReturnInfo(conversation, channelId, message, channel);
            conversation.guildId = channel.guildId;
            conversation.lastDiscordMessageId = message.id;

            await conversation.persist();
        } else {
            if (conversation != null) {
                conversation.lastDiscordMessageId = message.id;
                await conversation.persist();
            }
        }
    }

    static async handleMessageAndReturnInfo(info: BaseConversation | null, channelId: string, message: Message<boolean>, channel: DMChannel | GuildTextBasedChannel) {
        if (info === null) {
            info = new ChatGPTConversation(channelId,
                message.author.id,
                message.guildId ?? '',
                discordClient.user!.username,
                'text-davinci-003'
            );

            if (channel.isDMBased()) {
                info.isDirectMessage = true;
            }

            await info.persist();
        }

        messageReceivedInThread[info.threadId] = true;
        await info.handlePrompt(
            message.author,
            channel,
            message.content,
            message,
        );
        info.lastDiscordMessageId = message.id;
        return info;
    }

    static create(
        threadId: string,
        creatorId: string,
        guildId: string,
        username: string,
        model: ModelName,
    ): BaseConversation {
        return new ChatGPTConversation(threadId, creatorId, guildId, username, model);
    }
}
