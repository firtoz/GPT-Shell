"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Commands_1 = require("../Commands");
const startListeningToMessages_1 = require("./ready/message-handling/startListeningToMessages");
const initializeThreads_1 = require("./ready/initializeThreads");
const logMessage_1 = require("../../utils/logMessage");
const db_1 = require("../../database/db");
exports.default = (client) => {
    client.on(discord_js_1.Events.ClientReady, async () => {
        if (!client.user || !client.application) {
            return;
        }
        console.log("Initialising db...");
        if (!await db_1.db.initialise()) {
            throw new Error('failed to initialise...');
        }
        console.log("Connected to db.");
        await client.application.commands.set(Commands_1.Commands);
        console.log(`${client.user.username} is online`);
        (0, logMessage_1.logMessage)('Started!');
        const guilds = await client.guilds.fetch();
        (0, logMessage_1.logMessage)(`Currently in ${guilds.size} guild${guilds.size !== 1 ? 's' : ''}.`);
        (0, startListeningToMessages_1.StartListeningToMessages)(client);
        (0, initializeThreads_1.InitializeThreads)(client);
    });
};
//# sourceMappingURL=ready.js.map