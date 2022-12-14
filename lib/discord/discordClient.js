"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.discordClient = void 0;
const discord_js_1 = require("discord.js");
exports.discordClient = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent,
        discord_js_1.GatewayIntentBits.DirectMessages,
    ],
    'partials': [discord_js_1.Partials.Channel]
});
//# sourceMappingURL=discordClient.js.map