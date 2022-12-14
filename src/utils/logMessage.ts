import {discordClient} from "../discord/discordClient";
import {db} from "../database/db";
import {Channel} from "discord.js";
import {MultiMessage} from "../shared/MultiMessage";
import {getEnv} from "./GetEnv";

let logChannelPromise: Promise<Channel | null> | null = null;

function getLogChannel(): Promise<Channel | null> {
    if (logChannelPromise === null) {
        logChannelPromise = new Promise<Channel | null>(async resolve => {
            const logChannelId = getEnv('LOG_CHANNEL_ID') ?? await db.get<string>('LOG_CHANNEL_ID');
            console.log({logChannelId});
            if (logChannelId != null) {
                try {
                    const channel = await discordClient.channels.fetch(logChannelId);
                    resolve(channel);
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

export let messagePromise: Promise<any> = Promise.resolve();

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

export async function logMessage(...args: any[]): Promise<void> {
    console.error(...args);

    return new Promise((resolve) => {
        messagePromise.finally(() => {
            messagePromise = (async () => {
                try {
                    const logChannel = await getLogChannel();

                    if (logChannel !== null) {
                        if (logChannel.isTextBased()) {
                            try {
                                await new MultiMessage(logChannel)
                                    .update(args.map(arg => {
                                        const printed = printArg(arg);

                                        if (printed.length > 5000) {
                                            return printed.slice(0, 5000) + '...';
                                        }

                                        return printed;
                                    }).join('\n'), true)
                            } catch (e) {
                                console.error('Cannot write to log channel:', e);
                            }
                        }
                    }
                } finally {
                    resolve();
                }
            })();
        })
    });
}
