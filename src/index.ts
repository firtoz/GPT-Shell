import {GatewayIntentBits} from "discord.js";
import ready from "./discord/listeners/ready";
import interactionCreate from "./discord/listeners/interactionCreate";
import {getEnv} from "./utils/GetEnv";
import {discordClient} from "./discord/discordClient";
import * as process from "process";
import {logMessage, messagePromise} from "./utils/logMessage";
import serverJoin from "./discord/listeners/serverJoin";

(async () => {
    ready(discordClient);
    interactionCreate(discordClient);
    serverJoin(discordClient);

    const botToken = getEnv('BOT_TOKEN');

    console.log("Bot is starting...");

    if (!botToken) {
        throw new Error('NO BOT TOKEN');
    }

    global
        .process
        .on('uncaughtException', e => {
            logMessage('uncaughtException:', e);
        });

    await discordClient.login(botToken);
})();
