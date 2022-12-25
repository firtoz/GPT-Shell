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
    ComponentType,
    TextInputStyle
} from "discord.js";
import {getConfig} from "../../core/config";
import {printArg} from "../../utils/logMessage";
import {PineconeButtonCommand} from "./PineconeButtonCommand";

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
            content: `Config:\n${printArg(config)}`, components: [
                new ActionRowBuilder<ButtonBuilder>()
                    .addComponents(
                        new ButtonBuilder()
                            .setCustomId(PineconeButtonCommand.id)
                            .setLabel('Update Pinecone Config')
                            .setStyle(ButtonStyle.Primary),
                    ),
            ]
        });
    }
} : null;
