import {Command} from "../../Command";
import {Client, CommandInteraction} from "discord.js";
import {CustomPromptModal} from "../modals/CustomPromptModal";
import {getEnv} from "../../../utils/GetEnv";

const CUSTOM_PROMPT_COMMAND_NAME = getEnv('CUSTOM_PROMPT_COMMAND_NAME');

const adminPingId = getEnv('ADMIN_PING_ID');

export const CustomPromptCommand: Command | null = CUSTOM_PROMPT_COMMAND_NAME ? {
    description: "Allows the users to set a custom prompt for a thread or a channel",
    name: CUSTOM_PROMPT_COMMAND_NAME,
    deferred: false,
    ephemeral: true,
    async run(client: Client, interaction: CommandInteraction) {
        if(interaction.user.id !== adminPingId) {
            await interaction.reply({
                ephemeral: true,
                content: 'Only people with special permissions can use the custom prompt command.',
            });

            return;
        }
        const shown = await CustomPromptModal.show(interaction);

        if(!shown) {
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
