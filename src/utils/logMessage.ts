import {discordClient} from "../discord/discordClient";
import {db} from "../database/db";
import {
    CategoryChannel,
    Channel,
    DMChannel, ForumChannel,
    NewsChannel,
    PartialDMChannel,
    PartialGroupDMChannel, PrivateThreadChannel, PublicThreadChannel,
    StageChannel, TextBasedChannel, TextChannel, VoiceChannel
} from "discord.js";
import {MultiMessage} from "../shared/MultiMessage";
import {getEnv} from "./GetEnv";

let logChannelPromise: Promise<TextBasedChannel | null> | null = null;

function getLogChannel(): Promise<TextBasedChannel | null> {
    if (logChannelPromise === null) {
        logChannelPromise = new Promise<TextBasedChannel | null>(async resolve => {
            const logChannelId = getEnv('LOG_CHANNEL_ID') ?? await db.get<string>('LOG_CHANNEL_ID');
            console.log({logChannelId});
            if (logChannelId != null) {
                try {
                    const channel = await discordClient.channels.fetch(logChannelId);
                    if (channel && channel.isTextBased()) {
                        resolve(channel);
                    } else {
                        resolve(null);
                    }
                } catch (e) {
                    console.error(e);
                    resolve(null);
                }

                return;
            }

            resolve(null);
        });
    }

    return logChannelPromise;
}

function stringify(obj: any) {
    const seen = new WeakSet();
    return JSON.stringify(obj, (key, value) => {
        if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) {
                // Replace circular reference with a placeholder value
                return '[Circular]';
            }
            seen.add(value);
        }

        if (typeof value === 'function') {
            return `<FUNCTION>`;
        }

        return value;
    }, '  ');
}


function printArg(arg: any): string {
    switch (typeof arg) {
        case "function":
            return `<FUNCTION>`;
        case "object":
            return `\`\`\`json
${stringify(arg)}
\`\`\``;
        case "undefined":
        case "boolean":
        case "number":
        case "string":
        case "symbol":
        case "bigint":
            return String(arg);
    }
}

const messageQueue: string[] = [];

export let messagePromise: Promise<any> | null = null;

async function clearMessageQueue(logChannel: TextBasedChannel) {
    while (messageQueue.length > 0) {
        const nextMessages = messageQueue.splice(0, messageQueue.length);

        await new MultiMessage(logChannel).update(nextMessages.join('\n'), true);
    }

    messagePromise = null;
}

export async function logMessage(...args: any[]): Promise<void> {
    console.error(...args);

    const logChannel = await getLogChannel();

    if (!logChannel) {
        return;
    }

    const messageToPrint = args.map(arg => {
        const printed = printArg(arg);

        if (printed.length > 10000) {
            return printed.slice(0, 10000) + '...';
        }

        return printed;
    }).join('\n');

    messageQueue.push(`[${new Date().toLocaleString('default', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    })}] ${messageToPrint}`);

    if (!messagePromise) {
        messagePromise = clearMessageQueue(logChannel);
    }
}
