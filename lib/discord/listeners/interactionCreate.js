"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Commands_1 = require("../Commands");
const logMessage_1 = require("../../utils/logMessage");
const ButtonCommands_1 = require("../ButtonCommands");
const ModalSubmitHandlers_1 = require("../ModalSubmitHandlers");
async function handleModalSubmit(client, interaction) {
    const modalSubmit = ModalSubmitHandlers_1.ModalSubmitHandlers.find(c => c.id === interaction.customId);
    if (!modalSubmit) {
        await interaction.followUp({ content: 'An error has occurred' });
        return;
    }
    try {
        await modalSubmit.run(client, interaction);
    }
    catch (e) {
        (0, logMessage_1.logMessage)(`Cannot run modal submit command in guild [${interaction.guild?.name ?? 'Unknown Guild'}]`, e);
    }
    // return Promise.resolve(undefined);
}
exports.default = (client) => {
    client.on(discord_js_1.Events.InteractionCreate, async (interaction) => {
        try {
            if (interaction.isCommand() || interaction.isContextMenuCommand()) {
                return await handleSlashCommand(client, interaction);
            }
            if (interaction.isButton()) {
                return await handleButtonCommand(client, interaction);
            }
            if (interaction.isModalSubmit()) {
                return await handleModalSubmit(client, interaction);
            }
        }
        catch (e) {
            (0, logMessage_1.logMessage)('Cannot handle interaction: ', e);
        }
    });
};
const handleButtonCommand = async (client, interaction) => {
    const modalButtonCommand = ModalSubmitHandlers_1.ModalSubmitHandlers.find(c => c.hasButton && c.buttonId === interaction.customId);
    if (modalButtonCommand) {
        try {
            await modalButtonCommand.onButtonClick(interaction);
        }
        catch (e) {
            (0, logMessage_1.logMessage)(`Cannot run button command in guild [${interaction.guild?.name ?? 'Unknown Guild'}]`, e);
        }
        return;
    }
    const buttonCommand = ButtonCommands_1.ButtonCommands.find(c => c.id === interaction.customId);
    if (!buttonCommand) {
        await interaction.followUp({ content: 'An error has occurred' });
        return;
    }
    try {
        await buttonCommand.run(client, interaction);
    }
    catch (e) {
        (0, logMessage_1.logMessage)(`Cannot run button command in guild [${interaction.guild?.name ?? 'Unknown Guild'}]`, e);
    }
};
const handleSlashCommand = async (client, interaction) => {
    const slashCommand = Commands_1.Commands.find(c => c.name === interaction.commandName);
    if (!slashCommand) {
        await interaction.followUp({ content: "An error has occurred" });
        return;
    }
    if (slashCommand.deferred !== false) {
        await interaction.deferReply({
            ephemeral: slashCommand.ephemeral || false,
        });
    }
    try {
        slashCommand.run(client, interaction);
    }
    catch (e) {
        (0, logMessage_1.logMessage)(`Cannot run command in guild [${interaction.guild?.name ?? 'Unknown Guild'}]`, e);
    }
};
//# sourceMappingURL=interactionCreate.js.map