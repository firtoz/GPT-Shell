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
import {OpenAIAPIKeyButtonHandler, TokenLimitsButtonHandler} from "./TokenLimitsButtonHandler";

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
                    .setTitle(`${client.user!.username} Config`)
                    .setFields([
                        {
                            name: 'Pinecone:',
                            value: `${config.pineconeOptions ? '✅ Enabled!' : '☐ Disabled!'}
                            
Pinecone is used to have long-term memory. It stores information about all of the past messages in conversations which can then be queried.

See https://openai.com/blog/new-and-improved-embedding-model/ for more information.`,
                        },
                        {
                            name: 'Embed limits:',
                            value: `${config.maxMessagesToEmbed.toString()}.
                            
Embed limits are useful only for old conversations, after you have set up your Pinecone configuration.

When someone sends a message to an old conversation, this many messages from the history will be stored in the long term memory all at once.

As new messages are sent, they will be stored in long term memory one by one, so this value is useful only for conversations before V2. If you don't care about old conversations, set this to be 0.`,
                        },
                        {
                            name: 'Token limits:',
                            value: `Max tokens for prompt: ${config.modelInfo['text-davinci-003'].MAX_ALLOWED_TOKENS}.

This means, each message can cost at most ${(0.02 * config.modelInfo['text-davinci-003'].MAX_ALLOWED_TOKENS / 1000).toFixed(2)} cents.
                            
Max tokens for recent messages: ${config.maxTokensForRecentMessages}.

If max tokens for recent messages are less than max tokens for prompt, then the rest of the tokens will be used for the longer term memory.`,
                        },
                        {
                            name: 'OpenAI API Key',
                            value: config.openAIApiKey ?? '❌ Missing!',
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
                        new ButtonBuilder()
                            .setCustomId(OpenAIAPIKeyButtonHandler.id)
                            .setLabel('Change OpenAI API Key')
                            .setStyle(ButtonStyle.Primary),
                    ),
            ]
        });
    }
} : null;
