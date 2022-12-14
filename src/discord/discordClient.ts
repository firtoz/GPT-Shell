import {Client, GatewayIntentBits, Partials} from "discord.js";

export const discordClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
    ],
    'partials': [Partials.Channel]
});
