import {db} from "../database/db";
import {logMessage} from "../utils/logMessage";
import {
    Collection,
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
import {trySendingMessage} from "./TrySendingMessage";
import {getWhimsicalResponse} from "../discord/listeners/ready/getWhimsicalResponse";

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
    deleted: boolean = false;

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

    public async initialise(): Promise<void> {
        logMessage(`Initialising conversation: <#${this.threadId}>.`);

        const currentBotId = discordClient.user!.id;

        if (this.isDirectMessage) {
            const channel = await discordClient.channels.fetch(this.threadId);

            if (!channel) {
                return;
            }

            if (!channel.isDMBased()) {
                return;
            }

            if (!channel.isTextBased()) {
                return;
            }

            const user = await discordClient.users.fetch(this.creatorId);
            if (!user) {
                // cannot find user
                return;
            }

            let newMessagesCollection: Collection<string, Message<false>>;

            if (this.lastDiscordMessageId == null) {
                newMessagesCollection = await channel.messages.fetch({
                    limit: 20,
                });
            } else {
                newMessagesCollection = await channel.messages.fetch({
                    after: this.lastDiscordMessageId,
                });
            }


            let newMessages = Array.from(newMessagesCollection.values());
            newMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

            logMessage(`DM [${user.username}] new messages: ${newMessages.length}.`);

            await Promise.all(newMessages.map(newMessage => newMessage.fetch()));

            newMessages = newMessages.filter(message => message.author.id !== currentBotId);

            if (newMessages.length === 0) {
                console.log('No new messages, ignoring.');
                return;
            }

            let lastMessage: Message<false> = newMessages[newMessages.length - 1];

            await trySendingMessage(channel, {
                content: `[[${getWhimsicalResponse(user.id)}

I will respond to this message now.]]`
            });

            this.handlePrompt(lastMessage.author, channel, lastMessage.content, lastMessage)
                .catch(e => logMessage('INITIALIZEThreads', 'failed to handle prompt...', e));

            return;
        }

        if (this.guildId === null) {
            logMessage('no guild for info: ', this);

            const guilds = Array.from(discordClient.guilds.cache.values());
            for (const server of guilds) {
                const channel = await server.channels.fetch(this.threadId);
                if (channel != null) {
                    logMessage('found guild for info: ', this, server.id);
                    this.guildId = server.id;
                    await this.persist();
                }
            }
        }

        const server = discordClient.guilds.cache.get(this.guildId);

        if (server == null) {
            logMessage('INITIALIZEThreads', 'server null for info', this.guildId);
            return;
        }

        const threadResponse = await this.tryGetThread(server);

        if (!threadResponse.success) {
            logMessage(`${this.threadId} <#${this.threadId}>: Failed to get thread, status: ${threadResponse.status}`);

            if (threadResponse.status === 404) {
                logMessage(`Thread ${this.threadId} <#${this.threadId}> deleted (or never existed)! Marking as deleted...`);
                this.deleted = true;
                await this.persist();

                // TODO remove
                return;
            }

            return;
        }

        const thread = threadResponse.thread;

        if (thread == null) {
            logMessage(`Thread <#${this.threadId}> deleted, ignoring.`);
            return;
        }

        if (!thread.isTextBased()) {
            return;
        }

        let newMessagesCollection: Collection<string, Message<true>>;

        if (this.lastDiscordMessageId == null) {
            newMessagesCollection = await thread.messages.fetch({
                limit: 20,
            });
        } else {
            newMessagesCollection = await thread.messages.fetch({
                after: this.lastDiscordMessageId,
            });
        }

        const newMessages = Array.from(newMessagesCollection.values());
        newMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

        logMessage(`Thread [${thread.guild.name}] <#${this.threadId}> new messages: ${newMessages.length}.`);

        if (newMessages.length === 0) {
            console.log('No new messages, ignoring.');
            return;
        }

        await Promise.all(newMessages.map(newMessage => newMessage.fetch()));

        let lastRelevantMessage: Message<true> | null = null;

        if (!thread.isThread()) {
            for (let newMessage of newMessages) {
                if (newMessage.author.id === currentBotId) {
                    continue;
                }

                if (newMessage.mentions.users.has(currentBotId)) {
                    lastRelevantMessage = newMessage;
                }
            }

            this.lastDiscordMessageId = newMessages[newMessages.length - 1].id;

            if (lastRelevantMessage != null) {
                logMessage(`Found message for thread: <#${this.threadId}>`, lastRelevantMessage.content);

                if (!messageReceivedInThread[this.threadId]) {
                    await trySendingMessage(thread, {
                        content: `[[${getWhimsicalResponse(lastRelevantMessage.author.id)}

I will respond to this message now.]]`
                    });
                    this.handlePrompt(lastRelevantMessage.author, thread, lastRelevantMessage.content, lastRelevantMessage)
                        .catch(e => logMessage('INITIALIZEThreads', 'failed to handle prompt...', e));
                } else {
                    logMessage(`A new message is being handled for <#${this.threadId}> already, no need to respond.`);
                }
            }

            await this.persist();

            return;
        }


        for (let newMessage of newMessages) {
            if (newMessage.author.id === this.creatorId) {
                lastRelevantMessage = newMessage;
            }
        }

        if (lastRelevantMessage != null) {
            logMessage(`Found message for thread: <#${this.threadId}>`, lastRelevantMessage.content);

            if (!messageReceivedInThread[this.threadId]) {
                await trySendingMessage(thread, {
                    content: `[[${getWhimsicalResponse(this.creatorId)}

I will respond to your last prompt now.]]`,
                });
                this.handlePrompt(lastRelevantMessage.author, thread, lastRelevantMessage.content, lastRelevantMessage)
                    .catch(e => logMessage('INITIALIZEThreads', 'failed to handle prompt...', e));
            } else {
                logMessage(`A new message is being handled for <#${this.threadId}> already, no need to respond.`);
            }
        } else {
            logMessage(`Found no messages from user for thread: <#${this.threadId}>`);
        }
        this.lastDiscordMessageId = newMessages[newMessages.length - 1].id;
        await this.persist();
    }
}
