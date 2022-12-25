import {
    CommandInteraction,
    Client,
    Interaction,
    ContextMenuCommandInteraction,
    Events,
    ButtonInteraction
} from "discord.js";
import {ButtonCommands, Commands} from "../Commands";
import {logMessage} from "../../utils/logMessage";

export default (client: Client): void => {
    client.on(Events.InteractionCreate, async (interaction: Interaction) => {
        if (interaction.isCommand() || interaction.isContextMenuCommand()) {
            return await handleSlashCommand(client, interaction);
        }

        if (interaction.isButton()) {
            return await handleButtonCommand(client, interaction);
        }
    });
};

const handleButtonCommand = async (client: Client, interaction: ButtonInteraction): Promise<void> => {
    const buttonCommand = ButtonCommands.find(c => c.id === interaction.customId);
    if (!buttonCommand) {
        await interaction.followUp({content: 'An error has occurred'});

        return;
    }

    try {
        await buttonCommand.run(client, interaction);
    } catch (e) {
        logMessage(`Cannot run button command in guild [${interaction.guild?.name ?? 'Unknown Guild'}]`, e);
    }
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
