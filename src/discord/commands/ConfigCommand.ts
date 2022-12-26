import {getEnv} from "../../utils/GetEnv";
import {Command} from "../Command";
import {
    ActionRowBuilder,
    ApplicationCommandOptionData,
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ButtonBuilder,
    ButtonStyle,
    Client,
    CommandInteraction,
    ComponentType, EmbedBuilder,
    TextInputStyle
} from "discord.js";
import {getConfig} from "../../core/config";
import {printArg} from "../../utils/logMessage";
import {PineconeButtonHandler} from "./PineconeButtonHandler";
import {EmbedLimitButtonHandler} from "./EmbedLimitButtonHandler";
import {TokenLimitsButtonHandler} from "./TokenLimitsButtonHandler";

const CONFIG_COMMAND_NAME = getEnv('CONFIG_COMMAND_NAME');

const options: ApplicationCommandOptionData[] = [];

export const ConfigCommand: Command | null = CONFIG_COMMAND_NAME ? {
    name: CONFIG_COMMAND_NAME,
    description: "Sets the configuration for the bot.",
    type: ApplicationCommandType.ChatInput,
    ephemeral: true,
    options,
    run: async (client: Client, commandInteraction: CommandInteraction) => {
        const adminPingId = getEnv('ADMIN_PING_ID');

        if (commandInteraction.user.id !== adminPingId) {
            await commandInteraction.followUp({content: 'Only the bot owner can use this command for now.'});
            return;
        }

        const channel = commandInteraction.channel;
        if (!channel) {
            await commandInteraction.followUp({content: 'Interaction somehow not in a channel?'});
            return;
        }

        const config = await getConfig();

        await commandInteraction.followUp({
            // content: `Config:\n${printArg(config)}`,
            embeds: [
                new EmbedBuilder()
                    .setTitle(`${client.user!.tag} Config`)
                    .setFields([
                        {
                            name: 'Pinecone:',
                            value: config.pineconeOptions ? '✅ Enabled!' : '☐ Disabled!',
                        },
                        {
                            name: 'Embed limits:',
                            value: config.maxMessagesToEmbed.toString(),
                        },
                        {
                            name: 'Token limits:',
                            value: `Max tokens for recent messages: ${config.maxTokensForRecentMessages}
Max tokens for prompt: ${config.modelInfo['text-davinci-003'].MAX_ALLOWED_TOKENS}`,
                        },
                    ])
            ],
            components: [
                new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(PineconeButtonHandler.id)
                            .setLabel('Update Pinecone Config')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(EmbedLimitButtonHandler.id)
                            .setLabel('Change Embed Limit')
                            .setStyle(ButtonStyle.Primary),
                        new ButtonBuilder()
                            .setCustomId(TokenLimitsButtonHandler.id)
                            .setLabel('Change Token Limits')
                            .setStyle(ButtonStyle.Primary),
                    ),
            ]
        });
    }
} : null;
