"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logMessage = exports.messagePromise = exports.printArg = void 0;
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
                    if (channel && channel.isTextBased()) {
                        resolve(channel);
                    }
                    else {
                        resolve(null);
                    }
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
        if (value instanceof Error) {
            return `<ERROR ${value.name}> (cause: "${value.cause}"): message:"${value.message}": ${value.stack}`;
        }
        if (value instanceof RegExp) {
            return `<REGEX: ${value.source}>`;
        }
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
function printArg(arg) {
    switch (typeof arg) {
        case "function":
            return `<FUNCTION>`;
        case "object":
            return `\`\`\`json
${stringify(arg).replace(/```/g, '\\`\\`\\`')}
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
exports.printArg = printArg;
const messageQueue = [];
exports.messagePromise = null;
async function clearMessageQueue(logChannel) {
    while (messageQueue.length > 0) {
        const nextMessages = messageQueue.splice(0, messageQueue.length);
        const multiMessage = new MultiMessage_1.MultiMessage(logChannel);
        multiMessage.isLogMessage = true;
        await multiMessage.update(nextMessages.join('\n'), true);
    }
    exports.messagePromise = null;
}
function logMessage(...args) {
    console.error(...args);
    getLogChannel()
        .then(logChannel => {
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
        if (!exports.messagePromise) {
            exports.messagePromise = clearMessageQueue(logChannel);
        }
    });
}
exports.logMessage = logMessage;
//# sourceMappingURL=logMessage.js.map