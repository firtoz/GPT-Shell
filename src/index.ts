import {GatewayIntentBits} from "discord.js";
import ready from "./discord/listeners/ready";
import interactionCreate from "./discord/listeners/interactionCreate";
import {getEnv} from "./utils/GetEnv";
import {discordClient} from "./discord/discordClient";
import * as process from "process";
import {logMessage} from "./utils/logMessage";
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
            setTimeout(() => {
                process.exit(1);
            }, 10000);
            logMessage('CRASH:', e.message, e.stack, e)
                .finally(() => {
                    process.exit(1);
                });
        });

    await discordClient.login(botToken);
})();
