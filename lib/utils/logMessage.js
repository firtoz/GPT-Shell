"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logMessage = exports.messagePromise = void 0;
const discordClient_1 = require("../discord/discordClient");
const db_1 = require("../database/db");
const MultiMessage_1 = require("../shared/MultiMessage");
const GetEnv_1 = require("./GetEnv");
let logChannelPromise = null;
function getLogChannel() {
    if (logChannelPromise === null) {
        logChannelPromise = new Promise(async (resolve) => {
            const logChannelId = (0, GetEnv_1.getEnv)('LOG_CHANNEL_ID') ?? await db_1.db.get('LOG_CHANNEL_ID');
            console.log({ logChannelId });
            if (logChannelId != null) {
                try {
                    const channel = await discordClient_1.discordClient.channels.fetch(logChannelId);
                    resolve(channel);
                }
                catch (e) {
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
function stringify(obj) {
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
exports.messagePromise = Promise.resolve();
function printArg(arg) {
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
async function logMessage(...args) {
    console.error(...args);
    return new Promise((resolve) => {
        exports.messagePromise.finally(() => {
            exports.messagePromise = (async () => {
                try {
                    const logChannel = await getLogChannel();
                    if (logChannel !== null) {
                        if (logChannel.isTextBased()) {
                            try {
                                await new MultiMessage_1.MultiMessage(logChannel)
                                    .update(args.map(arg => {
                                    const printed = printArg(arg);
                                    if (printed.length > 5000) {
                                        return printed.slice(0, 5000) + '...';
                                    }
                                    return printed;
                                }).join('\n'), true);
                            }
                            catch (e) {
                                console.error('Cannot write to log channel:', e);
                            }
                        }
                    }
                }
                finally {
                    resolve();
                }
            })();
        });
    });
}
exports.logMessage = logMessage;
//# sourceMappingURL=logMessage.js.map