import {CommandInteraction, Client, Interaction, ContextMenuCommandInteraction, Events} from "discord.js";
import {Commands} from "../Commands";
import {logMessage} from "../../utils/logMessage";

export default (client: Client): void => {
    client.on(Events.InteractionCreate, async (interaction: Interaction) => {
        if (interaction.isCommand() || interaction.isContextMenuCommand()) {
            await handleSlashCommand(client, interaction);
        }
    });
};

const handleSlashCommand = async (client: Client, interaction: CommandInteraction | ContextMenuCommandInteraction): Promise<void> => {
    const slashCommand = Commands.find(c => c.name === interaction.commandName);
    if (!slashCommand) {
        await interaction.followUp({content: "An error has occurred"});
        return;
    }

    await interaction.deferReply({
        ephemeral: slashCommand.ephemeral || false,
    });

    try {
        slashCommand.run(client, interaction);
    } catch (e) {
        logMessage(`Cannot run command in guild [${interaction.guild?.name ?? 'Unknown Guild'}]`, e);
    }
};
