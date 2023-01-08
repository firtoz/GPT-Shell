"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Commands_1 = require("../Commands");
const startListeningToMessages_1 = require("./ready/message-handling/startListeningToMessages");
const initializeThreads_1 = require("./ready/initializeThreads");
const logMessage_1 = require("../../utils/logMessage");
const db_1 = require("../../database/db");
const config_1 = require("../../core/config");
const MainServerId_1 = require("../../core/MainServerId");
const GetOpenAIForId_1 = require("../../core/GetOpenAIForId");
const pinecone_1 = require("../../core/pinecone");
async function checkUsage(config) {
    try {
        const usage = await fetch("https://api.openai.com/v1/usage?date=2022-12-26", {
            "credentials": "include",
            "headers": {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:108.0) Gecko/20100101 Firefox/108.0",
                "Accept": "*/*",
                "Accept-Language": "en-GB",
                "Sec-Fetch-Dest": "empty",
                "Sec-Fetch-Mode": "no-cors",
                "Sec-Fetch-Site": "same-site",
                "Authorization": `Bearer ${config.openAIApiKey}`,
                "Pragma": "no-cache",
                "Cache-Control": "no-cache"
            },
            "referrer": "https://beta.openai.com/",
            "method": "GET",
            "mode": "cors"
        });
        const subscription = await fetch("https://api.openai.com/dashboard/billing/subscription", {
            "credentials": "include",
            "headers": {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:108.0) Gecko/20100101 Firefox/108.0",
                "Accept": "*/*",
                "Accept-Language": "en-GB",
                "Authorization": `Bearer ${config.openAIApiKey}`,
                "Sec-Fetch-Dest": "empty",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Site": "same-site"
            },
            "referrer": "https://beta.openai.com/",
            "method": "GET",
            "mode": "cors"
        });
        if (usage != null) {
            const json = await usage.json();
            (0, logMessage_1.logMessage)(`Usage fetch`, json);
        }
        if (subscription != null) {
            const json = await subscription.json();
            (0, logMessage_1.logMessage)(`Sub fetch`, json);
        }
    }
    catch (e) {
        (0, logMessage_1.logMessage)(`Usage fetch fail`, e);
    }
}
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
        await (0, config_1.getConfig)();
        await (0, config_1.getConfigForId)(MainServerId_1.mainServerId);
        let openaiSuccess = false;
        const openai = await (0, GetOpenAIForId_1.getOpenAIForId)(MainServerId_1.mainServerId);
        if (openai) {
            try {
                const models = await openai.listModels();
                if (models) {
                    openaiSuccess = true;
                }
            }
            catch (e) {
                (0, logMessage_1.logMessage)('Cannot use openai:', e);
            }
        }
        (0, logMessage_1.logMessage)(`Openai connection: ${openaiSuccess ? 'good' : 'bad'}!`);
        // await checkUsage(config);
        await (0, pinecone_1.getPineconeClient)();
        (0, startListeningToMessages_1.StartListeningToMessages)(client);
        (0, initializeThreads_1.InitializeThreads)();
    });
};
//# sourceMappingURL=ready.js.map