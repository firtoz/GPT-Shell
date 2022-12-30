import {
    CommandInteraction,
    Client,
    Interaction,
    ContextMenuCommandInteraction,
    Events,
    ButtonInteraction, ModalSubmitInteraction
} from "discord.js";
import {Commands} from "../Commands";
import {logMessage} from "../../utils/logMessage";
import {ButtonCommands} from "../ButtonCommands";
import {ModalSubmitHandlers} from "../ModalSubmitHandlers";
import {ModalConfig} from "../handlers/ModalConfig";

async function handleModalSubmit(client: Client, interaction: ModalSubmitInteraction) {
    const modalSubmit = ModalSubmitHandlers.find(c => c.id === interaction.customId);
    if (!modalSubmit) {
        await interaction.followUp({content: 'An error has occurred'});

        return;
    }

    try {
        await modalSubmit.run(client, interaction);
    } catch (e) {
        logMessage(`Cannot run modal submit command in guild [${interaction.guild?.name ?? 'Unknown Guild'}]`, e);
    }
    // return Promise.resolve(undefined);
}

export default (client: Client): void => {
    client.on(Events.InteractionCreate, async (interaction: Interaction) => {
        try {
            if (interaction.isCommand() || interaction.isContextMenuCommand()) {
                return await handleSlashCommand(client, interaction);
            }

            if (interaction.isButton()) {
                return await handleButtonCommand(client, interaction);
            }

            if(interaction.isModalSubmit()) {
                return await handleModalSubmit(client, interaction);
            }
        } catch (e) {
            logMessage('Cannot handle interaction: ', e);
        }
    });
};

const handleButtonCommand = async (client: Client, interaction: ButtonInteraction): Promise<void> => {
    const modalButtonCommand = ModalSubmitHandlers.find(c => c.hasButton && c.buttonId === interaction.customId) as ModalConfig<true>;
    if (modalButtonCommand) {
        try {
            await modalButtonCommand.onButtonClick(interaction);
        } catch (e) {
            logMessage(`Cannot run button command in guild [${interaction.guild?.name ?? 'Unknown Guild'}]`, e);
        }

        return;
    }

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

    if(slashCommand.deferred !== false) {
        await interaction.deferReply({
            ephemeral: slashCommand.ephemeral || false,
        });
    }

    try {
        slashCommand.run(client, interaction);
    } catch (e) {
        logMessage(`Cannot run command in guild [${interaction.guild?.name ?? 'Unknown Guild'}]`, e);
    }
};
