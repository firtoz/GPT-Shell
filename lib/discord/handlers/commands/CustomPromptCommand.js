"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomPromptCommand = void 0;
const discord_js_1 = require("discord.js");
const CustomPromptModal_1 = require("../modals/CustomPromptModal");
const GetEnv_1 = require("../../../utils/GetEnv");
const RetrieveConversation_1 = require("../../../core/RetrieveConversation");
const config_1 = require("../../../core/config");
const logMessage_1 = require("../../../utils/logMessage");
const CUSTOM_PROMPT_COMMAND_NAME = (0, GetEnv_1.getEnv)('CUSTOM_PROMPT_COMMAND_NAME');
const adminPingId = (0, GetEnv_1.getEnv)('ADMIN_PING_ID');
exports.CustomPromptCommand = CUSTOM_PROMPT_COMMAND_NAME ? {
    description: "Allows the users to set a custom prompt for a thread or a channel",
    name: CUSTOM_PROMPT_COMMAND_NAME,
    deferred: false,
    ephemeral: true,
    async run(client, interaction) {
        const channel = await client.channels.fetch(interaction.channelId);
        if (!channel) {
            await interaction.reply({
                ephemeral: true,
                content: 'Could not find a channel for the command.',
            });
            return;
        }
        const botConfig = await (0, config_1.getConfig)();
        const userOrServerHasPermissions = interaction.user.id === adminPingId
            || botConfig.promptPermissions.includes(interaction.user.id)
            || (!channel.isDMBased() && botConfig.promptPermissions.includes(channel.guildId));
        if (!userOrServerHasPermissions) {
            await interaction.reply({
                ephemeral: true,
                content: `You or the server does not have permissions to define custom prompts.

Please ask the bot owner for permissions.`,
            });
            return;
        }
        if (!channel.isDMBased()) {
            if (channel.isThread()) {
                const conversation = await (0, RetrieveConversation_1.retrieveConversation)(channel.id);
                if (!conversation) {
                    await interaction.reply({
                        ephemeral: true,
                        content: `Thread not created by ${client.user.username}.`,
                    });
                    return;
                }
                if (!(interaction.memberPermissions?.has('Administrator')
                    || conversation.creatorId === interaction.user.id)) {
                    await interaction.reply({
                        ephemeral: true,
                        content: `Only <@${conversation.creatorId}> or a server admin can edit the prompt in this thread.`,
                    });
                    return;
                }
            }
            else {
                // typical channel
                if (!interaction.memberPermissions?.has('Administrator')) {
                    await interaction.reply({
                        ephemeral: true,
                        content: `Only server admins can set custom prompts for channels.`,
                    });
                    return;
                }
            }
        }
        else {
            if (channel.type === discord_js_1.ChannelType.DM) {
                // go ahead
            }
            else {
                await interaction.reply({
                    ephemeral: true,
                    content: `Only 1-1 DMs can be used as conversations so far.`,
                });
                return;
            }
        }
        let shown = false;
        try {
            shown = await CustomPromptModal_1.CustomPromptModal.show(interaction);
        }
        catch (e) {
            (0, logMessage_1.logMessage)(e);
        }
        if (!shown) {
            await interaction.reply({
                ephemeral: true,
                content: 'Cannot show modal',
            });
        }
        else {
            await interaction.followUp({
                ephemeral: true,
                content: 'Showing custom prompt modal.',
            });
        }
    }
} : null;
//# sourceMappingURL=CustomPromptCommand.js.map