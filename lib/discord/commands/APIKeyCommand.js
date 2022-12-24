"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.APIKeyCommand = void 0;
const GetEnv_1 = require("../../utils/GetEnv");
const discord_js_1 = require("discord.js");
const openai_1 = require("openai");
const logMessage_1 = require("../../utils/logMessage");
const db_1 = require("../../database/db");
const discordClient_1 = require("../discordClient");
const GetOpenAIKeyForId_1 = require("../../core/GetOpenAIKeyForId");
const API_KEY_COMMAND_NAME = (0, GetEnv_1.getEnv)('API_KEY_COMMAND_NAME');
const options = [
    {
        name: 'token',
        type: discord_js_1.ApplicationCommandOptionType.String,
        description: 'Token.',
        required: true,
    }
];
async function handleToken(interaction, isDM) {
    const token = interaction.options.get('token');
    const idToUse = isDM ? interaction.user.id : interaction.guildId;
    if (idToUse == null) {
        const message = `Could not identify ${isDM ? 'user' : 'server'} id... Please message the bot owner!`;
        (0, logMessage_1.logMessage)(message);
        await interaction.followUp(message);
        return;
    }
    if (idToUse === null) {
        (0, logMessage_1.logMessage)(`idToUse null: ${interaction.user.username} - ${interaction.guildId} - isDM: ${isDM}`);
        await interaction.followUp('Error... could not identify the server or the user. Please ping the bot owner!');
        return;
    }
    (0, logMessage_1.logMessage)(`Token supplied for [${isDM ? `User:${interaction.user.username}` :
        `Server:${await (0, discordClient_1.getGuildName)(interaction.guildId)}`}]`);
    if (token == null) {
        (0, logMessage_1.logMessage)(`INVALID token supplied for [${isDM ? `User:${interaction.user.username}` :
            `Server:${await (0, discordClient_1.getGuildName)(interaction.guildId)}`}]`);
        await interaction.followUp({
            content: 'Invalid token parameter.',
        });
        return;
    }
    const tokenValue = token.value;
    const api = new openai_1.OpenAIApi(new openai_1.Configuration({
        apiKey: tokenValue,
    }));
    try {
        const models = await api.listModels();
        const data = models.data;
        if (data != null) {
            // Token is good!
            (0, logMessage_1.logMessage)(`GOOD token supplied for [${isDM ? `User:${interaction.user.username}` :
                `Server:${await (0, discordClient_1.getGuildName)(interaction.guildId)}`}]`);
            GetOpenAIKeyForId_1.OpenAICache[idToUse] = api;
            await db_1.db.set(`CONFIG-API-KEY-${idToUse}`, tokenValue);
            GetOpenAIKeyForId_1.OpenAICache[idToUse] = undefined;
            await interaction.followUp({
                content: 'Token Accepted.',
            });
        }
    }
    catch (e) {
        const err = e;
        (0, logMessage_1.logMessage)({ tokenValue, status: err.status, data: err.response?.data });
        const data = err.response?.data;
        (0, logMessage_1.logMessage)(`BAD token supplied for [${isDM ? `User:${interaction.user.username}` :
            `Server:${await (0, discordClient_1.getGuildName)(interaction.guildId)}`}]`);
        if (data != null) {
            const message = data?.error?.message;
            if (message != null) {
                await interaction.followUp({
                    content: `Token Rejected: ${message}.`,
                });
                return;
            }
        }
        await interaction.followUp({
            content: 'Token Rejected.',
        });
    }
}
exports.APIKeyCommand = API_KEY_COMMAND_NAME ? {
    name: API_KEY_COMMAND_NAME,
    description: "Sets the OPENAI token for a server or user.",
    type: discord_js_1.ApplicationCommandType.ChatInput,
    ephemeral: true,
    options,
    run: async (client, interaction) => {
        if (!interaction.channel) {
            await client.channels.fetch(interaction.channelId);
        }
        const channel = interaction.channel;
        if (channel && channel.isDMBased()) {
            await handleToken(interaction, true);
            return;
        }
        if (!interaction.memberPermissions?.has('Administrator')) {
            interaction.followUp('Only administrator accounts can use this command.');
            return;
        }
        await handleToken(interaction, false);
    }
} : null;
//# sourceMappingURL=APIKeyCommand.js.map