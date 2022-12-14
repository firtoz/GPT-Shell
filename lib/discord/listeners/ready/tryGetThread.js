"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.tryGetThread = void 0;
const discord_js_1 = require("discord.js");
const logMessage_1 = require("../../../utils/logMessage");
async function tryGetThread(server, info) {
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
    }
    catch (e) {
        if (e instanceof discord_js_1.DiscordAPIError) {
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
            (0, logMessage_1.logMessage)('INITIALIZEThreads', e.status);
            return {
                success: false,
                status: e.status,
                error: e,
            };
        }
        (0, logMessage_1.logMessage)('INITIALIZEThreads', e);
        return {
            success: false,
            status: -1,
            error: e,
        };
    }
}
exports.tryGetThread = tryGetThread;
//# sourceMappingURL=tryGetThread.js.map