"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptPermissionsModal = void 0;
const DefineModal_1 = require("../DefineModal");
const discord_js_1 = require("discord.js");
const config_1 = require("../../../core/config");
exports.PromptPermissionsModal = (0, DefineModal_1.defineModal)('PROMPT-PERMISSIONS-MODAL', 'Prompt Permissions', {
    label: 'Change Prompt Permissions',
    textOnClick: 'Updating Prompt Permissions...',
}, [{
        name: 'promptPermissions',
        label: 'Permission IDs (server/user)',
        defaultValue: '',
        placeholder: '[ID1]\n[ID2]',
        required: false,
        style: discord_js_1.TextInputStyle.Paragraph,
    }], async () => {
    const config = await (0, config_1.getConfig)();
    return {
        promptPermissions: `${config.promptPermissions.join('\n')}`
    };
}, async (values, submitInteraction) => {
    try {
        const config = await (0, config_1.getConfig)();
        const { promptPermissions } = values;
        config.promptPermissions = (promptPermissions ?? '')
            .split('\n')
            .map(item => item.trim())
            .filter(item => item.length > 0);
        await (0, config_1.setConfig)(config);
        await submitInteraction.followUp({
            content: '',
            embeds: [
                new discord_js_1.EmbedBuilder()
                    .setDescription(`Updated.

People or servers with permissions:

${config.promptPermissions.join('\n')}`)
                    .setColor(0x00ff00)
            ],
            components: [],
        });
    }
    catch (e) {
        await submitInteraction.followUp({
            content: 'Failure to save',
            embeds: e.message ? [
                new discord_js_1.EmbedBuilder()
                    .setDescription(e.message)
                    .setColor(0xff0000)
            ] : [],
            components: [],
        });
    }
});
//# sourceMappingURL=PromptPermissionsModal.js.map