"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatChannelsModal = void 0;
const DefineModal_1 = require("../DefineModal");
const discord_js_1 = require("discord.js");
const config_1 = require("../../../core/config");
const ConfigCommand_1 = require("../commands/ConfigCommand");
exports.ChatChannelsModal = (0, DefineModal_1.defineModal)('CHAT-CHANNELS-MODAL', 'Chat Channels', {
    label: 'Change Chat Channels',
    textOnClick: 'Updating Chat Channels...',
}, [{
        name: 'chatChannelIds',
        label: 'Chat Channel Ids',
        defaultValue: '',
        placeholder: '[ID1]\n[ID2]',
        required: false,
        style: discord_js_1.TextInputStyle.Paragraph,
    }], async (interaction) => {
    const { configId } = await (0, ConfigCommand_1.getConfigIdForInteraction)(interaction);
    if (!configId) {
        throw new Error('No config id found for interaction...');
    }
    const config = await (0, config_1.getConfigForId)(configId);
    return {
        chatChannelIds: `${config.chatChannelIds.join('\n')}`
    };
}, async (values, submitInteraction) => {
    try {
        const { configId } = await (0, ConfigCommand_1.getConfigIdForInteraction)(submitInteraction);
        if (!configId) {
            throw new Error('No config id found for interaction...');
        }
        const config = await (0, config_1.getConfigForId)(configId);
        const { chatChannelIds } = values;
        config.chatChannelIds = (chatChannelIds ?? '')
            .split('\n')
            .map(item => item.trim())
            .filter(item => item.length > 0);
        await (0, config_1.setConfigForId)(configId, config);
        await submitInteraction.followUp({
            content: '',
            embeds: [
                new discord_js_1.EmbedBuilder()
                    .setDescription(`Updated.\n\nChat channels:\n\n${config.chatChannelIds.map(item => `<#${item}>`).join('\n')}`)
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
//# sourceMappingURL=ChatChannelsModal.js.map