"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DrawCommand = void 0;
const GetEnv_1 = require("../../../utils/GetEnv");
const discord_js_1 = require("discord.js");
const config_1 = require("../../../core/config");
const GetMessageCountForUser_1 = require("../../../core/GetMessageCountForUser");
const discordClient_1 = require("../../discordClient");
const GetOpenAIForId_1 = require("../../../core/GetOpenAIForId");
const logMessage_1 = require("../../../utils/logMessage");
const GetMissingAPIKeyResponse_1 = require("../../../utils/GetMissingAPIKeyResponse");
const ImageHandler_1 = require("../../../core/ImageHandler");
const DRAW_COMMAND_NAME = (0, GetEnv_1.getEnv)('DRAW_COMMAND_NAME');
const adminPingId = (0, GetEnv_1.getEnv)('ADMIN_PING_ID');
const CONFIG_COMMAND_NAME = (0, GetEnv_1.getEnv)('CONFIG_COMMAND_NAME');
exports.DrawCommand = DRAW_COMMAND_NAME ? {
    name: DRAW_COMMAND_NAME,
    dmPermission: true,
    ephemeral: true,
    description: 'Tries to draw an image',
    type: discord_js_1.ApplicationCommandType.ChatInput,
    options: [
        {
            name: 'input',
            type: discord_js_1.ApplicationCommandOptionType.String,
            description: 'Prompt',
            required: true,
        },
    ],
    run: async (client, interaction) => {
        if (!interaction.isChatInputCommand()) {
            return;
        }
        const channel = await client.channels.fetch(interaction.channelId);
        if (!channel) {
            await interaction.followUp({
                ephemeral: true,
                content: 'Cannot access channel...',
            });
            return;
        }
        try {
            if (channel.isTextBased() && !channel.isDMBased()) {
                const guildMember = await channel.guild.members.fetch(client.user.id);
                const permissions = channel
                    .permissionsFor(guildMember.id);
                const hasPermissions = permissions.has(discord_js_1.PermissionFlagsBits.ViewChannel, false)
                    && permissions.has(discord_js_1.PermissionFlagsBits.SendMessages, false);
                if (!hasPermissions) {
                    await interaction.followUp({
                        ephemeral: true,
                        content: 'Cannot access channel...',
                    });
                    return;
                }
            }
        }
        catch (e) {
            await interaction.followUp({
                ephemeral: true,
                content: 'Cannot access channel...',
            });
            return;
        }
        const userId = interaction.user.id;
        let currentConfig = await (0, config_1.getConfigForId)(userId);
        let openai = undefined;
        const isDirectMessage = !interaction.inGuild();
        if (isDirectMessage || currentConfig.useKeyInServersToo) {
            openai = await (0, GetOpenAIForId_1.getOpenAIForId)(userId);
        }
        let usingOpenAIForServer = false;
        if (!isDirectMessage && !openai) {
            openai = await (0, GetOpenAIForId_1.getOpenAIForId)(interaction.guildId);
            usingOpenAIForServer = true;
            currentConfig = await (0, config_1.getConfigForId)(interaction.guildId);
        }
        if (!openai) {
            (0, logMessage_1.logMessage)(`No api key for [${(isDirectMessage ? interaction.user.username : await (0, discordClient_1.getGuildName)(interaction.guildId))}].`);
            const response = await (0, GetMissingAPIKeyResponse_1.getMissingAPIKeyResponse)(isDirectMessage);
            const MAIN_SERVER_INVITE = (0, GetEnv_1.getEnv)('MAIN_SERVER_INVITE');
            if (MAIN_SERVER_INVITE) {
                response.content += '\n' + MAIN_SERVER_INVITE;
            }
            await interaction.followUp({
                ...response,
                ephemeral: true,
            });
            return;
        }
        if (!isDirectMessage) {
            const guildId = interaction.guildId;
            const guild = await discordClient_1.discordClient.guilds.fetch(guildId);
            const member = await guild.members.fetch(userId);
            const userHasExceptionRole = currentConfig
                .exceptionRoleIds
                .some(exceptionRoleId => member.roles.cache.has(exceptionRoleId));
            const messageCounter = await (0, config_1.getMessageCounter)(guildId);
            const userShouldBeRestricted = usingOpenAIForServer
                && currentConfig.maxImagePerUser != -1
                && userId !== adminPingId
                && !userHasExceptionRole;
            if (userShouldBeRestricted) {
                const messageCountForUser = (0, GetMessageCountForUser_1.getMessageCountForUser)(messageCounter, userId);
                if (messageCountForUser.imageLimitCount >= currentConfig.maxImagePerUser) {
                    await interaction.followUp({
                        ephemeral: true,
                        content: '',
                        embeds: [
                            new discord_js_1.EmbedBuilder()
                                .setTitle('Image Limit')
                                .setDescription(`
Detected [[DRAW]] commands but image limit was reached.
                                    
The bot has generated ${messageCountForUser.imageLimitCount} images out of the maximum allowed ${currentConfig.maxImagePerUser}.

The bot will not be able to generate any more images for you in this server until the server Admin allows for more.

This limit resets every month.
                             
If you'd like to use your own API key to generate images, you can provide your API key by using \`/${CONFIG_COMMAND_NAME}\` in a DM to me.

You can contact a server Admin if you have any questions.

Thank you for your understanding.`),
                        ]
                    });
                    return;
                }
                messageCountForUser.imageCount += 1;
                messageCountForUser.imageLimitCount += 1;
                messageCounter[userId] = messageCountForUser;
                await (0, config_1.saveMessageCounter)(guildId, messageCounter);
            }
        }
        const inputOption = interaction.options.get('input');
        const inputValue = inputOption.value;
        await interaction.followUp({
            ephemeral: false,
            content: `Prompt accepted.`,
        });
        const reply = await interaction.followUp({
            ephemeral: false,
            embeds: [
                new discord_js_1.EmbedBuilder()
                    .setAuthor({
                    name: interaction.user.username,
                    iconURL: interaction.user.avatarURL() ?? undefined,
                })
                    .setDescription(`/${DRAW_COMMAND_NAME} ${inputValue}`),
            ],
        });
        await interaction.deleteReply();
        await ImageHandler_1.ImageHandler.handle(openai, [inputValue], userId, reply, true);
    }
} : null;
//# sourceMappingURL=DrawCommand.js.map