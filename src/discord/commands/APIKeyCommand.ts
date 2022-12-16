import {getEnv} from "../../utils/GetEnv";
import {Command} from "../Command";
import {
    ApplicationCommandOptionData,
    ApplicationCommandOptionType,
    ApplicationCommandType, Client,
    CommandInteraction
} from "discord.js";
import {Configuration, OpenAIApi} from "openai";
import {logMessage} from "../../utils/logMessage";
import {AxiosError} from "axios";
import {db} from "../../database/db";
import {getGuildName} from "../discordClient";
import {OpenAICache} from "../../core/GetOpenAIKeyForId";

const API_KEY_COMMAND_NAME = getEnv('API_KEY_COMMAND_NAME');


const options: ApplicationCommandOptionData[] = [
    {
        name: 'token',
        type: ApplicationCommandOptionType.String,
        description: 'Token.',
        required: true,
    }
];

async function handleToken(interaction: CommandInteraction, isDM: boolean) {
    const token = interaction.options.get('token');

    const idToUse = isDM ? interaction.user.id : interaction.guildId;
    if(idToUse == null) {
        const message = `Could not identify ${isDM ? 'user': 'server'} id... Please message the bot owner!`;
        logMessage(message);
        await interaction.followUp(message);
        return;
    }

    if(idToUse === null) {
        logMessage(`idToUse null: ${interaction.user.username} - ${interaction.guildId} - isDM: ${isDM}`)
        await interaction.followUp('Error... could not identify the server or the user. Please ping the bot owner!');
        return;
    }

    logMessage(`Token supplied for [${isDM ? `User:${interaction.user.username}`: 
        `Server:${await getGuildName(interaction.guildId)}`}]`);

    if (token == null) {
        logMessage(`INVALID token supplied for [${isDM ? `User:${interaction.user.username}`:
            `Server:${await getGuildName(interaction.guildId)}`}]`);

        await interaction.followUp({
            content: 'Invalid token parameter.',
        });

        return;
    }


    const tokenValue = token.value as string;
    const api = new OpenAIApi(new Configuration({
        apiKey: tokenValue,
    }));

    try {
        const models = await api.listModels();
        const data = models.data;

        if (data != null) {
            // Token is good!

            logMessage(`GOOD token supplied for [${isDM ? `User:${interaction.user.username}`:
                `Server:${await getGuildName(interaction.guildId)}`}]`);

            OpenAICache[idToUse] = api;

            await db.set(`CONFIG-API-KEY-${idToUse}`, tokenValue);
            OpenAICache[idToUse] = undefined;

            await interaction.followUp({
                content: 'Token Accepted.',
            });
        }
    } catch (e) {
        const err = e as AxiosError;

        logMessage({tokenValue, status: err.status, data: err.response?.data})

        const data = err.response?.data as any;

        logMessage(`BAD token supplied for [${isDM ? `User:${interaction.user.username}`:
            `Server:${await getGuildName(interaction.guildId)}`}]`);

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
        })
    }
}

export const APIKeyCommand: Command | null = API_KEY_COMMAND_NAME ? {
    name: API_KEY_COMMAND_NAME,
    description: "Sets the OPENAI token for a server or user.",
    type: ApplicationCommandType.ChatInput,
    ephemeral: true,
    options,
    run: async (client: Client, interaction: CommandInteraction) => {
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
