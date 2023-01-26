import {Command} from "../../Command";
import {ChannelType, Client, CommandInteraction} from "discord.js";
import {CustomPromptModal} from "../modals/CustomPromptModal";
import {getEnv} from "../../../utils/GetEnv";
import {retrieveConversation} from "../../../core/RetrieveConversation";
import {ChatGPTConversation} from "../../../core/ChatGPTConversation";
import {getConfig, getConfigForId} from "../../../core/config";
import {logMessage} from "../../../utils/logMessage";

const CUSTOM_PROMPT_COMMAND_NAME = getEnv('CUSTOM_PROMPT_COMMAND_NAME');

const adminPingId = getEnv('ADMIN_PING_ID');

export const CustomPromptCommand: Command | null = CUSTOM_PROMPT_COMMAND_NAME ? {
    description: "Allows the users to set a custom prompt for a thread or a channel",
    name: CUSTOM_PROMPT_COMMAND_NAME,
    deferred: false,
    ephemeral: true,
    async run(client: Client, interaction: CommandInteraction) {
        const channel = await client.channels.fetch(interaction.channelId);

        if (!channel) {
            await interaction.reply({
                ephemeral: true,
                content: 'Could not find a channel for the command.',
            });

            return;
        }


        const botConfig = await getConfig();
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
                const conversation = await retrieveConversation(channel.id);

                if (!conversation) {
                    await interaction.reply({
                        ephemeral: true,
                        content: `Thread not created by ${client.user!.username}.`,
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
            } else {
                // typical channel
                if (!interaction.memberPermissions?.has('Administrator')) {
                    await interaction.reply({
                        ephemeral: true,
                        content: `Only server admins can set custom prompts for channels.`,
                    });
                    return;
                }
            }
        } else {
            if (channel.type === ChannelType.DM) {
                // go ahead
            } else {
                await interaction.reply({
                    ephemeral: true,
                    content: `Only 1-1 DMs can be used as conversations so far.`,
                });

                return;
            }
        }

        let shown: boolean = false;
        try {
            shown = await CustomPromptModal.show(interaction);
        } catch (e) {
            logMessage(e);
        }

        if (!shown) {
            await interaction.reply({
                ephemeral: true,
                content: 'Cannot show modal',
            });
        } else {
            await interaction.followUp({
                ephemeral: true,
                content: 'Showing custom prompt modal.',
            });
        }
    }
} : null;
