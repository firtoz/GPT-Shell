"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const logMessage_1 = require("../../utils/logMessage");
exports.default = (client) => {
    client.on(discord_js_1.Events.GuildCreate, (guild) => {
        (0, logMessage_1.logMessage)(`Joined [${guild.name}]! Total guilds: ${client.guilds.cache.size}.`);
    });
    client.on(discord_js_1.Events.GuildDelete, (guild) => {
        (0, logMessage_1.logMessage)(`Left [${guild.name}]! Total guilds: ${client.guilds.cache.size}.`);
    });
};
//# sourceMappingURL=serverJoin.js.map