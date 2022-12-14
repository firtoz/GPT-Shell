"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ready_1 = __importDefault(require("./discord/listeners/ready"));
const interactionCreate_1 = __importDefault(require("./discord/listeners/interactionCreate"));
const GetEnv_1 = require("./utils/GetEnv");
const discordClient_1 = require("./discord/discordClient");
const process = __importStar(require("process"));
const logMessage_1 = require("./utils/logMessage");
(async () => {
    (0, ready_1.default)(discordClient_1.discordClient);
    (0, interactionCreate_1.default)(discordClient_1.discordClient);
    const botToken = (0, GetEnv_1.getEnv)('BOT_TOKEN');
    console.log("Bot is starting...");
    if (!botToken) {
        throw new Error('NO BOT TOKEN');
    }
    global
        .process
        .on('uncaughtException', e => {
        setTimeout(() => {
            process.exit(1);
        }, 10000);
        (0, logMessage_1.logMessage)('CRASH:', e.message, e.stack, e)
            .finally(() => {
            process.exit(1);
        });
    });
    await discordClient_1.discordClient.login(botToken);
})();
//# sourceMappingURL=index.js.map