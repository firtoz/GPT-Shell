"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ready_1 = __importDefault(require("./discord/listeners/ready"));
const interactionCreate_1 = __importDefault(require("./discord/listeners/interactionCreate"));
const GetEnv_1 = require("./utils/GetEnv");
const discordClient_1 = require("./discord/discordClient");
const logMessage_1 = require("./utils/logMessage");
const serverJoin_1 = __importDefault(require("./discord/listeners/serverJoin"));
(async () => {
    (0, ready_1.default)(discordClient_1.discordClient);
    (0, interactionCreate_1.default)(discordClient_1.discordClient);
    (0, serverJoin_1.default)(discordClient_1.discordClient);
    const botToken = (0, GetEnv_1.getEnv)('BOT_TOKEN');
    console.log("Bot is starting...");
    if (!botToken) {
        throw new Error('NO BOT TOKEN');
    }
    global
        .process
        .on('uncaughtException', e => {
        (0, logMessage_1.logMessage)('uncaughtException:', e);
    });
    await discordClient_1.discordClient.login(botToken);
})();
//# sourceMappingURL=index.js.map