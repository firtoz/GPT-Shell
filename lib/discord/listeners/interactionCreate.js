"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const Commands_1 = require("../Commands");
const logMessage_1 = require("../../utils/logMessage");
exports.default = (client) => {
    client.on(discord_js_1.Events.InteractionCreate, async (interaction) => {
        if (interaction.isCommand() || interaction.isContextMenuCommand()) {
            await handleSlashCommand(client, interaction);
        }
    });
};
const handleSlashCommand = async (client, interaction) => {
    const slashCommand = Commands_1.Commands.find(c => c.name === interaction.commandName);
    if (!slashCommand) {
        await interaction.followUp({ content: "An error has occurred" });
        return;
    }
    await interaction.deferReply({
        ephemeral: slashCommand.ephemeral || false,
    });
    try {
        slashCommand.run(client, interaction);
    }
    catch (e) {
        (0, logMessage_1.logMessage)(`Cannot run command in guild [${interaction.guild?.name ?? 'Unknown Guild'}]`, e);
    }
};
//# sourceMappingURL=interactionCreate.js.map