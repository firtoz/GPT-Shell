"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigCommand = exports.getConfigIdForInteraction = void 0;
const GetEnv_1 = require("../../../utils/GetEnv");
const discord_js_1 = require("discord.js");
const config_1 = require("../../../core/config");
const logMessage_1 = require("../../../utils/logMessage");
const discordClient_1 = require("../../discordClient");
const MainServerId_1 = require("../../../core/MainServerId");
const OpenAIAPIKeyModal_1 = require("../modals/OpenAIAPIKeyModal");
const PineconeModal_1 = require("../modals/PineconeModal");
const EmbedLimitModal_1 = require("../modals/EmbedLimitModal");
const TokenLimitsModal_1 = require("../modals/TokenLimitsModal");
const GetMessageLimitsMessage_1 = require("./GetMessageLimitsMessage");
const MessageLimitsModal_1 = require("../modals/MessageLimitsModal");
const GetOpenAIForId_1 = require("../../../core/GetOpenAIForId");
const TogglePersonalInServersButtonHandler_1 = require("../buttonCommandHandlers/TogglePersonalInServersButtonHandler");
const ChatChannelsModal_1 = require("../modals/ChatChannelsModal");
const GetMessageCountForUser_1 = require("../../../core/GetMessageCountForUser");
const PromptPermissionsModal_1 = require("../modals/PromptPermissionsModal");
const ModerationsModal_1 = require("../modals/ModerationsModal");
const CUSTOM_PROMPT_COMMAND_NAME = (0, GetEnv_1.getEnv)('CUSTOM_PROMPT_COMMAND_NAME');
const CONFIG_COMMAND_NAME = (0, GetEnv_1.getEnv)('CONFIG_COMMAND_NAME');
if (!CONFIG_COMMAND_NAME) {
    throw new Error(`CONFIG_COMMAND_NAME env variable is obligatory.`);
}
const USE_SAME_API_KEY_FOR_ALL = (0, GetEnv_1.getEnv)('USE_SAME_API_KEY_FOR_ALL');
const options = [];
async function getConfigIdForInteraction(commandInteraction) {
    let configId = null;
    let isDM = false;
    const channel = commandInteraction.channelId ?
        await discordClient_1.discordClient.channels.fetch(commandInteraction.channelId)
        : null;
    if (channel) {
        if (channel.isDMBased()) {
            if (channel.type === discord_js_1.ChannelType.DM) {
                isDM = true;
                configId = channel.recipientId;
            }
        }
        else {
            configId = channel.guildId;
        }
    }
    return { configId, isDM };
}
exports.getConfigIdForInteraction = getConfigIdForInteraction;
async function generateFollowUp(configId, isDM, user) {
    const config = await (0, config_1.getConfigForId)(configId);
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
        new discord_js_1.ActionRowBuilder()
            .addComponents(TokenLimitsModal_1.TokenLimitsModal.getButtonComponent()),
    ];
    if (USE_SAME_API_KEY_FOR_ALL !== 'true' || configId === MainServerId_1.mainServerId) {
        fields.push({
            name: 'OpenAI API Key',
            value: `${config.openAIApiKey ? `✅ ${config.openAIApiKey.slice(0, 3)}${config.openAIApiKey.slice(3).replace(/./g, 'x')}` : '❌ Missing!'}

You can find your API key at [https://beta.openai.com/account/api-keys](https://beta.openai.com/account/api-keys).`,
        });
        components[0] = components[0].addComponents(OpenAIAPIKeyModal_1.OpenAIAPIKeyModal.getButtonComponent());
    }
    const messageCounter = await (0, config_1.getMessageCounter)(configId);
    if (!isDM) {
        fields.push({
            name: 'Message Limits',
            value: (0, GetMessageLimitsMessage_1.getMessageLimitsMessage)(config),
        });
        const totalSum = Object
            .values(messageCounter)
            .reduce((sum, item) => sum + item.count, 0);
        const userConfig = await (0, config_1.getConfigForId)(user.id);
        if (userConfig.useKeyInServersToo) {
            fields.push({
                name: 'Unlimited Messages',
                value: `You are using your own API key for the messages, so you can send an unlimited number of messages to me in any server.
                            
If you'd like to use the server's API key, please send me the /${CONFIG_COMMAND_NAME} command in a DM.

Total messages sent by all users of this server's API key: ${totalSum}.`,
            });
        }
        else {
            const messageCountForUser = (0, GetMessageCountForUser_1.getMessageCountForUser)(messageCounter, user.id);
            (0, logMessage_1.logMessage)('messageCountForUser', messageCountForUser);
            fields.push({
                name: 'Sent Messages',
                value: `You sent ${messageCountForUser.limitCount}/${config.maxMessagePerUser === -1 ? 'Unlimited' : config.maxMessagePerUser} messages.

You generated ${messageCountForUser.imageLimitCount}/${config.maxImagePerUser === -1 ? 'Unlimited' : config.maxImagePerUser} images.

Total messages sent by all users of this server's API key: ${totalSum}.`
            });
        }
        components[0] = components[0]
            .addComponents(MessageLimitsModal_1.MessageLimitsModal.getButtonComponent());
    }
    else {
        fields.push({
            name: 'Personal API Key',
            value: config.useKeyInServersToo ? 'Your API key will be used in all servers.' : 'Your API key will only be used in DMs.',
        });
        components[0] = components[0]
            .addComponents(new discord_js_1.ButtonBuilder()
            .setCustomId(TogglePersonalInServersButtonHandler_1.TogglePersonalInServersButtonHandler.id)
            .setLabel(config.useKeyInServersToo ? 'Use my API key for DMs only' : 'Use my API key for server conversations')
            .setStyle(config.useKeyInServersToo ? discord_js_1.ButtonStyle.Danger : discord_js_1.ButtonStyle.Primary));
    }
    const embedForServerOrUser = new discord_js_1.EmbedBuilder()
        .setTitle(`${isDM ? `USER [${user.tag}]` : `SERVER [${await (0, discordClient_1.getGuildName)(configId)}]`} Config`)
        .setFields(fields);
    const embeds = [
        embedForServerOrUser,
    ];
    if (!isDM) {
        embeds.push(new discord_js_1.EmbedBuilder()
            .setTitle('Auto-Chat Channels')
            .setDescription(`${config.chatChannelIds.length > 0 ? config.chatChannelIds.map(item => `<#${item}>`).join('\n') : 'None specified.'}`));
        components.push(new discord_js_1.ActionRowBuilder()
            .addComponents(ChatChannelsModal_1.ChatChannelsModal.getButtonComponent()));
    }
    return {
        ephemeral: true,
        embeds,
        components,
    };
}
exports.ConfigCommand = {
    name: CONFIG_COMMAND_NAME,
    description: "Sets the configuration for the bot.",
    type: discord_js_1.ApplicationCommandType.ChatInput,
    ephemeral: true,
    options,
    run: async (client, commandInteraction) => {
        const channel = commandInteraction.channel;
        if (!channel) {
            await commandInteraction.followUp({ content: 'Interaction somehow not in a channel?' });
            return;
        }
        const adminPingId = (0, GetEnv_1.getEnv)('ADMIN_PING_ID');
        const { configId, isDM } = await getConfigIdForInteraction(commandInteraction);
        if (commandInteraction.user.id === adminPingId && !isDM && configId === MainServerId_1.mainServerId) {
            const config = await (0, config_1.getConfig)();
            const fields = [
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
            let actionRowBuilder = new discord_js_1.ActionRowBuilder()
                .addComponents(PineconeModal_1.PineconeModal.getButtonComponent(), EmbedLimitModal_1.EmbedLimitModal.getButtonComponent());
            if (CUSTOM_PROMPT_COMMAND_NAME) {
                fields.push({
                    name: 'Prompt Permissions:',
                    value: `${(await Promise.all(config.promptPermissions.map(async (item) => {
                        try {
                            const user = await discordClient_1.discordClient.users.fetch(item);
                            return `(${user.tag}) <@${item}>`;
                        }
                        catch (e) {
                            return `<@${item}>`;
                        }
                    }))).join('\n')}

These people can use the /${CUSTOM_PROMPT_COMMAND_NAME} command.`,
                });
                actionRowBuilder = actionRowBuilder.addComponents(PromptPermissionsModal_1.PromptPermissionsModal.getButtonComponent());
            }
            fields.push({
                name: 'Moderation Thresholds:',
                value: `\`\`\`json
${(0, ModerationsModal_1.moderationResultToString)(config.moderationThreshold)}.
\`\`\`
                
The higher the value, the more will be allowed.

For example if a message has violence rating 0.9, and the moderation threshold is 0.8, then it won't be allowed, because it's too violent.

0 means allow nothing, 1 means allow everything.`,
            });
            actionRowBuilder = actionRowBuilder.addComponents(ModerationsModal_1.ModerationsModal.getButtonComponent());
            await commandInteraction.followUp({
                ephemeral: true,
                embeds: [
                    new discord_js_1.EmbedBuilder()
                        .setTitle(`${client.user.username} - BOT Config`)
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
                    const userConfig = await (0, config_1.getConfigForId)(commandInteraction.user.id);
                    const openai = (0, GetOpenAIForId_1.getOpenAIForId)(commandInteraction.user.id);
                    if (userConfig.useKeyInServersToo && openai !== null) {
                        const fields = [{
                                name: 'Unlimited Messages',
                                value: `You are using your own API key for the messages, so you can send an unlimited number of messages to me in any server.
                            
If you'd like to use the server's API key, please send me the /${CONFIG_COMMAND_NAME} command in a DM.`,
                            }];
                        await commandInteraction.followUp({
                            ephemeral: true,
                            embeds: [
                                new discord_js_1.EmbedBuilder()
                                    .setFields(fields)
                            ],
                        });
                        return;
                    }
                    if (configId != null) {
                        const config = await (0, config_1.getConfigForId)(configId);
                        const messageCounter = await (0, config_1.getMessageCounter)(configId);
                        (0, logMessage_1.logMessage)(`Showing config for [${isDM ? `User:${commandInteraction.user.tag}` :
                            `Server:${await (0, discordClient_1.getGuildName)(configId)}, by User:${commandInteraction.user.tag}`}]`);
                        const messageCountForUser = (0, GetMessageCountForUser_1.getMessageCountForUser)(messageCounter, commandInteraction.user.id);
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
                                new discord_js_1.EmbedBuilder()
                                    .setTitle(`${isDM ? `USER [${commandInteraction.user.tag}]` : `SERVER [${await (0, discordClient_1.getGuildName)(configId)}]`} Config`)
                                    .setFields(fields)
                            ],
                        });
                    }
                    return;
                }
            }
            if (configId != null) {
                (0, logMessage_1.logMessage)(`Showing config for [${isDM ? `User:${commandInteraction.user.tag}` :
                    `Server:${await (0, discordClient_1.getGuildName)(configId)}, by User:${commandInteraction.user.tag}`}]`);
                const followUp = await generateFollowUp(configId, isDM, commandInteraction.user);
                await commandInteraction.followUp(followUp);
            }
        }
    }
};
//# sourceMappingURL=ConfigCommand.js.map