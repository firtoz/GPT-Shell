import {getEnv} from "../../../utils/GetEnv";
import {Command} from "../../Command";
import {
    ActionRowBuilder,
    APIEmbedField,
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
    TextInputStyle,
    User
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
import {getOpenAIForId} from "../../../core/GetOpenAIForId";
import {TogglePersonalInServersButtonHandler} from "../buttonCommandHandlers/TogglePersonalInServersButtonHandler";
import {ChatChannelsModal} from "../modals/ChatChannelsModal";
import {getMessageCountForUser} from "../../../core/GetMessageCountForUser";
import {PromptPermissionsModal} from "../modals/PromptPermissionsModal";
import {moderationResultToString, ModerationsModal} from "../modals/ModerationsModal";

const CUSTOM_PROMPT_COMMAND_NAME = getEnv('CUSTOM_PROMPT_COMMAND_NAME');

const CONFIG_COMMAND_NAME = getEnv('CONFIG_COMMAND_NAME');
if (!CONFIG_COMMAND_NAME) {
    throw new Error(`CONFIG_COMMAND_NAME env variable is obligatory.`);
}

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

async function generateFollowUp(configId: string, isDM: boolean, user: User) {
    const config = await getConfigForId(configId);

    const fields = [
        {
            name: 'Token limits:',
            value: `Max tokens for prompt: ${config.modelInfo['text-davinci-003'].MAX_ALLOWED_TOKENS}.

Conversations start at less than a cent per message. As a conversation gets longer, the cost starts to rise as more and more tokens are used.

With this configuration, each message can cost at most \$${(0.02 * config.modelInfo['text-davinci-003'].MAX_ALLOWED_TOKENS / 1000).toFixed(2)} USD.

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
                value: `${config.openAIApiKey ? `✅ ${config.openAIApiKey.slice(0, 3)}${config.openAIApiKey.slice(3).replace(/./g, 'x')}` : '❌ Missing!'}

You can find your API key at [https://beta.openai.com/account/api-keys](https://beta.openai.com/account/api-keys).`,
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
                (sum, item) => sum + item!.count,
                0,
            );

        const userConfig = await getConfigForId(user.id);

        if (userConfig.useKeyInServersToo) {
            fields.push({
                name: 'Unlimited Messages',
                value: `You are using your own API key for the messages, so you can send an unlimited number of messages to me in any server.
                            
If you'd like to use the server's API key, please send me the /${CONFIG_COMMAND_NAME} command in a DM.

Total messages sent by all users of this server's API key: ${totalSum}.`,
            });
        } else {
            const messageCountForUser = getMessageCountForUser(messageCounter, user.id);

            logMessage('messageCountForUser', messageCountForUser);

            fields.push({
                name: 'Sent Messages',
                value: `You sent ${messageCountForUser.limitCount}/${config.maxMessagePerUser === -1 ? 'Unlimited' : config.maxMessagePerUser} messages.

You generated ${messageCountForUser.imageLimitCount}/${config.maxImagePerUser === -1 ? 'Unlimited' : config.maxImagePerUser} images.

Total messages sent by all users of this server's API key: ${totalSum}.`
            });
        }

        components[0] = components[0]
            .addComponents(
                MessageLimitsModal.getButtonComponent(),
            );
    } else {
        fields.push(
            {
                name: 'Personal API Key',
                value: config.useKeyInServersToo ? 'Your API key will be used in all servers.' : 'Your API key will only be used in DMs.',
            });

        components[0] = components[0]
            .addComponents(
                new ButtonBuilder()
                    .setCustomId(TogglePersonalInServersButtonHandler.id)
                    .setLabel(config.useKeyInServersToo ? 'Use my API key for DMs only' : 'Use my API key for server conversations')
                    .setStyle(config.useKeyInServersToo ? ButtonStyle.Danger : ButtonStyle.Primary),
            );
    }

    const embedForServerOrUser = new EmbedBuilder()
        .setTitle(`${isDM ? `USER [${user.tag}]` : `SERVER [${await getGuildName(configId)}]`} Config`)
        .setFields(fields);

    const embeds = [
        embedForServerOrUser,
    ];


    if (!isDM) {
        embeds.push(new EmbedBuilder()
            .setTitle('Auto-Chat Channels')
            .setDescription(`${config.chatChannelIds.length > 0 ? config.chatChannelIds.map(item => `<#${item}>`).join('\n') : 'None specified.'}`)
        )

        components.push(new ActionRowBuilder<ButtonBuilder>()
            .addComponents(
                ChatChannelsModal.getButtonComponent(),
            )
        );
    }

    return {
        ephemeral: true,
        embeds,
        components,
    };
}

export const ConfigCommand: Command = {
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

            const fields: APIEmbedField[] = [
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
            ];

            let actionRowBuilder = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(
                    PineconeModal.getButtonComponent(),
                    EmbedLimitModal.getButtonComponent(),
                );

            if (CUSTOM_PROMPT_COMMAND_NAME) {
                fields.push({
                    name: 'Prompt Permissions:',
                    value: `${(await Promise.all(config.promptPermissions.map(async item => {
                        try {
                            const user = await discordClient.users.fetch(item);

                            return `(${user.tag}) <@${item}>`;
                        } catch (e) {
                            return `<@${item}>`;
                        }
                    }))).join('\n')}

These people can use the /${CUSTOM_PROMPT_COMMAND_NAME} command.`,
                });

                actionRowBuilder = actionRowBuilder.addComponents(
                    PromptPermissionsModal.getButtonComponent(),
                );
            }

            fields.push({
                name: 'Moderation Thresholds:',
                value: `\`\`\`json
${moderationResultToString(config.moderationThreshold)}.
\`\`\`
                
The higher the value, the more will be allowed.

For example if a message has violence rating 0.9, and the moderation threshold is 0.8, then it won't be allowed, because it's too violent.

0 means allow nothing, 1 means allow everything.`,
            });

            actionRowBuilder = actionRowBuilder.addComponents(
                ModerationsModal.getButtonComponent(),
            );

            await commandInteraction.followUp({
                ephemeral: true,
                embeds: [
                    new EmbedBuilder()
                        .setTitle(`${client.user!.username} - BOT Config`)
                        .setFields(fields)
                ],
                components: [
                    actionRowBuilder,
                ]
            });
        }

        if (commandInteraction.channelId) {
            if (!isDM) {
                if (!commandInteraction.memberPermissions?.has('Administrator')) {
                    const userConfig = await getConfigForId(commandInteraction.user.id);
                    const openai = getOpenAIForId(commandInteraction.user.id);

                    if (userConfig.useKeyInServersToo && openai !== null) {
                        const fields = [{
                            name: 'Unlimited Messages',
                            value: `You are using your own API key for the messages, so you can send an unlimited number of messages to me in any server.
                            
If you'd like to use the server's API key, please send me the /${CONFIG_COMMAND_NAME} command in a DM.`,
                        }];

                        await commandInteraction.followUp({
                            ephemeral: true,
                            embeds: [
                                new EmbedBuilder()
                                    .setFields(fields)
                            ],
                        });

                        return;
                    }

                    if (configId != null) {
                        const config = await getConfigForId(configId);

                        const messageCounter = await getMessageCounter(configId);

                        logMessage(`Showing config for [${isDM ? `User:${commandInteraction.user.tag}` :
                            `Server:${await getGuildName(configId)}, by User:${commandInteraction.user.tag}`}]`);

                        const messageCountForUser = getMessageCountForUser(messageCounter, commandInteraction.user.id);
                        const fields = [{
                            name: 'Sent Messages',
                            value: `You sent ${messageCountForUser.limitCount}/${config.maxMessagePerUser === -1 ? 'Unlimited' : config.maxMessagePerUser} messages.`
                        }, {
                            name: 'Generated Images',
                            value: `You generated ${messageCountForUser.imageLimitCount}/${config.maxImagePerUser === -1 ? 'Unlimited' : config.maxImagePerUser} images.`
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
                logMessage(`Showing config for [${isDM ? `User:${commandInteraction.user.tag}` :
                    `Server:${await getGuildName(configId)}, by User:${commandInteraction.user.tag}`}]`);

                const followUp = await generateFollowUp(configId, isDM, commandInteraction.user);

                await commandInteraction.followUp(followUp);
            }
        }

    }
};
