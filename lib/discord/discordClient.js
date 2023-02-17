"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getGuildName = exports.discordClient = void 0;
const discord_js_1 = require("discord.js");
exports.discordClient = new discord_js_1.Client({
    intents: [
        discord_js_1.GatewayIntentBits.Guilds,
        discord_js_1.GatewayIntentBits.GuildMessages,
        discord_js_1.GatewayIntentBits.MessageContent,
        discord_js_1.GatewayIntentBits.DirectMessages,
        discord_js_1.GatewayIntentBits.GuildMessageReactions,
        discord_js_1.GatewayIntentBits.DirectMessageReactions,
    ],
    'partials': [discord_js_1.Partials.Channel]
});
const getGuildName = async (guildId) => {
    if (!guildId) {
        return `[UNKNOWN GUILD]`;
    }
    try {
        const guild = await exports.discordClient.guilds.fetch(guildId);
        return guild.name;
    }
    catch (e) {
        return '[UNKNOWN GUILD]';
    }
};
exports.getGuildName = getGuildName;
//# sourceMappingURL=discordClient.js.map