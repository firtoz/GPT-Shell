import {Client, GatewayIntentBits, Partials} from "discord.js";

export const discordClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessageReactions,
    ],
    'partials': [Partials.Channel]
});

export const getGuildName = async (guildId: string | null) => {
    if (!guildId) {
        return `[UNKNOWN GUILD]`;
    }

    try {
        const guild = await discordClient.guilds.fetch(guildId);

        return guild.name;
    } catch (e) {
        return '[UNKNOWN GUILD]';
    }
}
