import {getEnv} from "../../../utils/GetEnv";
import {Command} from "../../Command";
import {
    ActionRowBuilder,
    ApplicationCommandOptionData,
    ApplicationCommandOptionType,
    ApplicationCommandType,
    BaseInteraction,
    ButtonBuilder,
    ButtonStyle,
    ChannelType,
    Client,
    CommandInteraction,
    ComponentType,
    EmbedBuilder,
    TextInputStyle
} from "discord.js";
import {getConfig, getConfigForId, getMessageCounter} from "../../../core/config";
import {logMessage} from "../../../utils/logMessage";
import {discordClient, getGuildName} from "../../discordClient";
import {mainServerId} from "../../../core/MainServerId";
import {OpenAIAPIKeyModal} from "../modals/OpenAIAPIKeyModal";
import {PineconeModal} from "../modals/PineconeModal";
import {EmbedLimitModal} from "../modals/EmbedLimitModal";
import {TokenLimitsModal} from "../modals/TokenLimitsModal";
import {getMessageLimitsMessage} from "./GetMessageLimitsMessage";
import {MessageLimitsModal} from "../modals/MessageLimitsModal";

const CONFIG_COMMAND_NAME = getEnv('CONFIG_COMMAND_NAME');
const USE_SAME_API_KEY_FOR_ALL = getEnv('USE_SAME_API_KEY_FOR_ALL');

const options: ApplicationCommandOptionData[] = [];

export async function getConfigIdForInteraction(commandInteraction: BaseInteraction) {
    let configId: string | null = null;
    let isDM = false;

    const channel = commandInteraction.channelId ?
        await discordClient.channels.fetch(commandInteraction.channelId)
        : null;
    if (channel) {
        if (channel.isDMBased()) {
            if (channel.type === ChannelType.DM) {
                isDM = true;
                configId = channel.recipientId;
            }
        } else {
            configId = channel.guildId;
        }
    }

    return {configId, isDM};
}

export const ConfigCommand: Command | null = CONFIG_COMMAND_NAME ? {
    name: CONFIG_COMMAND_NAME,
    description: "Sets the configuration for the bot.",
    type: ApplicationCommandType.ChatInput,
    ephemeral: true,
    options,
    run: async (client: Client, commandInteraction: CommandInteraction) => {
        const channel = commandInteraction.channel;
        if (!channel) {
            await commandInteraction.followUp({content: 'Interaction somehow not in a channel?'});
            return;
        }

        const adminPingId = getEnv('ADMIN_PING_ID');

        const {configId, isDM} = await getConfigIdForInteraction(commandInteraction);

        if (commandInteraction.user.id === adminPingId && !isDM && configId === mainServerId) {
            const config = await getConfig();

            await commandInteraction.followUp({
                ephemeral: true,
                embeds: [
                    new EmbedBuilder()
                        .setTitle(`${client.user!.username}- BOT Config`)
                        .setFields([
                            {
                                name: 'Pinecone:',
                                value: `${config.pineconeOptions ? '✅ Enabled!' : '❌ Disabled!'}
                            
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
                        ])
                ],
                components: [
                    new ActionRowBuilder<ButtonBuilder>()
                        .addComponents(
                            PineconeModal.getButtonComponent(),
                            EmbedLimitModal.getButtonComponent(),
                        ),
                ]
            });
        }

        if (commandInteraction.channelId) {
            if (!isDM) {
                if (!commandInteraction.memberPermissions?.has('Administrator')) {
                    if (configId != null) {
                        const config = await getConfigForId(configId);

                        const messageCounter = await getMessageCounter(configId);

                        logMessage(`Showing config for [${isDM ? `User:${commandInteraction.user.tag}` :
                            `Server:${await getGuildName(configId)}, by User:${commandInteraction.user.tag}`}]`);

                        const fields = [{
                            name: 'Sent Messages',
                            value: `You sent ${messageCounter[commandInteraction.user.id] ?? 0}/${config.maxMessagePerUser === -1 ? 'Unlimited' : config.maxMessagePerUser}.`
                        }];

                        await commandInteraction.followUp({
                            ephemeral: true,
                            embeds: [
                                new EmbedBuilder()
                                    .setTitle(`${isDM ? `USER [${commandInteraction.user.tag}]` : `SERVER [${await getGuildName(configId)}]`} Config`)
                                    .setFields(fields)
                            ],
                        });

                    }

                    return;
                }
            }

            if (configId != null) {
                const config = await getConfigForId(configId);

                logMessage(`Showing config for [${isDM ? `User:${commandInteraction.user.tag}` :
                    `Server:${await getGuildName(configId)}, by User:${commandInteraction.user.tag}`}]`);

                const fields = [
                    {
                        name: 'Token limits:',
                        value: `Max tokens for prompt: ${config.modelInfo['text-davinci-003'].MAX_ALLOWED_TOKENS}.

This means, each message can cost at most \$${(0.02 * config.modelInfo['text-davinci-003'].MAX_ALLOWED_TOKENS / 1000).toFixed(2)} USD.

Max tokens for recent messages: ${config.maxTokensForRecentMessages}.

If max tokens for recent messages are less than max tokens for prompt, then the rest of the tokens will be used for the longer term memory.`,
                    }
                ];

                const components = [
                    new ActionRowBuilder<ButtonBuilder>()
                        .addComponents(
                            TokenLimitsModal.getButtonComponent(),
                        ),
                ];

                if (USE_SAME_API_KEY_FOR_ALL !== 'true' || configId === mainServerId) {
                    fields.push(
                        {
                            name: 'OpenAI API Key',
                            value: config.openAIApiKey ? `✅ ${config.openAIApiKey.slice(0, 3)}${config.openAIApiKey.slice(3).replace(/./g, 'x')}` : '❌ Missing!',
                        }
                    );

                    components[0] = components[0].addComponents(
                        OpenAIAPIKeyModal.getButtonComponent(),
                    );
                }

                const messageCounter = await getMessageCounter(configId);

                if (!isDM) {
                    fields.push(
                        {
                            name: 'Message Limits',
                            value: getMessageLimitsMessage(config),
                        });

                    const totalSum = Object
                        .values(messageCounter)
                        .reduce(
                            (sum, item) => sum! + (item == undefined ? 0 : item),
                            0,
                        );

                    fields.push({
                        name: 'Sent Messages',
                        value: `You sent ${messageCounter[commandInteraction.user.id] ?? 0}/${config.maxMessagePerUser === -1 ? 'Unlimited' : config.maxMessagePerUser}.

Total: ${totalSum}.`
                    });

                    components[0] = components[0]
                        .addComponents(
                            MessageLimitsModal.getButtonComponent(),
                        );
                }

                await commandInteraction.followUp({
                    ephemeral: true,
                    embeds: [
                        new EmbedBuilder()
                            .setTitle(`${isDM ? `USER [${commandInteraction.user.tag}]` : `SERVER [${await getGuildName(configId)}]`} Config`)
                            .setFields(fields)
                    ],
                    components,
                });

            }
        }

    }
} : null;