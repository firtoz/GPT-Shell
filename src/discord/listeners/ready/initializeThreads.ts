import {Client, Collection, Message} from "discord.js";
import {ChatGPTConversation} from "../../../core/ChatGPTConversation";
import {logMessage} from "../../../utils/logMessage";
import {getWhimsicalResponse} from "./getWhimsicalResponse";
import {tryGetThread} from "./tryGetThread";
import {messageReceivedInThread} from "./message-handling/handleThread";

export function InitializeThreads(client: Client<boolean>) {
    const currentBotId = client.user!.id;

    ChatGPTConversation.initialise(async info => {
        logMessage(`Initialising thread: <#${info.threadId}>.`);

        if (info.isDirectMessage) {
            const channel = await client.channels.fetch(info.threadId);

            if (!channel) {
                return;
            }

            if (!channel.isDMBased()) {
                return;
            }

            if (!channel.isTextBased()) {
                return;
            }

            const user = await client.users.fetch(info.creatorId);
            if (!user) {
                // cannot find user
                return;
            }

            let newMessagesCollection: Collection<string, Message<false>>;

            if (info.lastDiscordMessageId == null) {
                newMessagesCollection = await channel.messages.fetch({
                    limit: 20,
                });
            } else {
                newMessagesCollection = await channel.messages.fetch({
                    after: info.lastDiscordMessageId,
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

            channel.send(`[[${getWhimsicalResponse(user.id)}

I will respond to this message now.]]`);
            info.handlePrompt(lastMessage.author, channel, lastMessage.content, lastMessage)
                .catch(e => logMessage('INITIALIZEThreads', 'failed to handle prompt...', e));

            return;
        }

        if (info.guildId === null) {
            logMessage('no guild for info: ', info);

            const guilds = Array.from(client.guilds.cache.values());
            for (const server of guilds) {
                const channel = await server.channels.fetch(info.threadId);
                if (channel != null) {
                    logMessage('found guild for info: ', info, server.id);
                    info.guildId = server.id;
                    await info.persist();
                }
            }
        }

        const server = client.guilds.cache.get(info.guildId);

        if (server == null) {
            logMessage('INITIALIZEThreads', 'server null for info', info);
            return;
        }

        const threadResponse = await tryGetThread(server, info);

        if (!threadResponse.success) {
            logMessage(`${info.threadId} <#${info.threadId}>: Failed to get thread, status: ${threadResponse.status}`);

            if (threadResponse.status === 404) {
                logMessage(`Thread ${info.threadId} <#${info.threadId}> deleted (or never existed)! Marking as deleted...`);
                info.deleted = true;
                await info.persist();

                // TODO remove
                return;
            }

            return;
        }

        const thread = threadResponse.thread;

        if (thread == null) {
            logMessage(`Thread <#${info.threadId}> deleted, ignoring.`);
            return;
        }

        if (!thread.isTextBased()) {
            return;
        }

        let newMessagesCollection: Collection<string, Message<true>>;

        if (info.lastDiscordMessageId == null) {
            newMessagesCollection = await thread.messages.fetch({
                limit: 20,
            });
        } else {
            newMessagesCollection = await thread.messages.fetch({
                after: info.lastDiscordMessageId,
            });
        }

        const newMessages = Array.from(newMessagesCollection.values());
        newMessages.sort((a, b) => a.createdTimestamp - b.createdTimestamp);

        logMessage(`Thread [${thread.guild.name}] <#${info.threadId}> new messages: ${newMessages.length}.`);

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

            info.lastDiscordMessageId = newMessages[newMessages.length - 1].id;

            if (lastRelevantMessage != null) {
                logMessage(`Found message for thread: <#${info.threadId}>`, lastRelevantMessage.content);

                if (!messageReceivedInThread[info.threadId]) {
                    thread.send(`[[${getWhimsicalResponse(lastRelevantMessage.author.id)}

I will respond to this message now.]]`);
                    info.handlePrompt(lastRelevantMessage.author, thread, lastRelevantMessage.content, lastRelevantMessage)
                        .catch(e => logMessage('INITIALIZEThreads', 'failed to handle prompt...', e));
                } else {
                    logMessage(`A new message is being handled for <#${info.threadId}> already, no need to respond.`);
                }
            }

            await info.persist();

            return;
        }


        for (let newMessage of newMessages) {
            if (newMessage.author.id === info.creatorId) {
                lastRelevantMessage = newMessage;
            }
        }

        if (lastRelevantMessage != null) {
            logMessage(`Found message for thread: <#${info.threadId}>`, lastRelevantMessage.content);

            if (!messageReceivedInThread[info.threadId]) {
                thread.send(`[[${getWhimsicalResponse(info.creatorId)}

I will respond to your last prompt now.]]`);
                info.handlePrompt(lastRelevantMessage.author, thread, lastRelevantMessage.content, lastRelevantMessage)
                    .catch(e => logMessage('INITIALIZEThreads', 'failed to handle prompt...', e));
            } else {
                logMessage(`A new message is being handled for <#${info.threadId}> already, no need to respond.`);
            }
        } else {
            logMessage(`Found no messages from user for thread: <#${info.threadId}>`);
        }
        info.lastDiscordMessageId = newMessages[newMessages.length - 1].id;
        await info.persist();
    }).catch(e => {
        logMessage('INITIALIZEThreads', 'Initialise error...');
    });
}
