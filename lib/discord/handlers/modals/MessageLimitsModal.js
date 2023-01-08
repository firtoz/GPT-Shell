"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageLimitsModal = void 0;
const DefineModal_1 = require("../DefineModal");
const discord_js_1 = require("discord.js");
const config_1 = require("../../../core/config");
const lodash_1 = require("lodash");
const ConfigCommand_1 = require("../commands/ConfigCommand");
const GetMessageLimitsMessage_1 = require("../commands/GetMessageLimitsMessage");
exports.MessageLimitsModal = (0, DefineModal_1.defineModal)('MESSAGE-LIMIT-MODAL', 'Message Limits', {
    label: 'Change Message Limits',
    textOnClick: 'Updating Message Limits...',
}, [
    {
        name: 'maxMessagePerUser',
        label: 'Max Messages Allowed for Non-API Key Users',
        defaultValue: '-1',
        placeholder: '-1',
        required: true,
        style: discord_js_1.TextInputStyle.Short,
    },
    {
        name: 'maxImagePerUser',
        label: 'Max Image Generations for Non-API Key Users',
        defaultValue: '-1',
        placeholder: '-1',
        required: true,
        style: discord_js_1.TextInputStyle.Short,
    },
    {
        name: 'messageExpiredNote',
        label: 'Additional Note For users',
        defaultValue: '',
        placeholder: 'Please contact a server admin to get access for unlimited messages.',
        required: false,
        style: discord_js_1.TextInputStyle.Short,
    },
    {
        name: 'exceptionRoleIds',
        label: 'Exception Role Ids',
        defaultValue: '',
        placeholder: '[ID1]\n[ID2]',
        required: false,
        style: discord_js_1.TextInputStyle.Paragraph,
    }
], async (interaction) => {
    const { configId } = await (0, ConfigCommand_1.getConfigIdForInteraction)(interaction);
    if (!configId) {
        throw new Error('No config id found for interaction...');
    }
    const config = await (0, config_1.getConfigForId)(configId);
    return {
        maxMessagePerUser: `${config.maxMessagePerUser}`,
        maxImagePerUser: `${config.maxImagePerUser}`,
        exceptionRoleIds: `${config.exceptionRoleIds.join('\n')}`,
        messageExpiredNote: config.messageExpiredNote,
    };
}, async (values, submitInteraction) => {
    try {
        const { configId } = await (0, ConfigCommand_1.getConfigIdForInteraction)(submitInteraction);
        if (!configId) {
            throw new Error('No config id found for interaction...');
        }
        const config = await (0, config_1.getConfigForId)(configId);
        const { maxMessagePerUser, maxImagePerUser, exceptionRoleIds, messageExpiredNote, } = values;
        const maxMessagePerUserValue = (0, lodash_1.parseInt)(maxMessagePerUser ?? '-1');
        const maxImagePerUserValue = (0, lodash_1.parseInt)(maxImagePerUser ?? '-1');
        if (!isNaN(maxMessagePerUserValue)) {
            config.maxMessagePerUser = maxMessagePerUserValue < 0 ? -1 : maxMessagePerUserValue;
            config.maxImagePerUser = maxImagePerUserValue < 0 ? -1 : maxImagePerUserValue;
            config.messageExpiredNote = messageExpiredNote ?? '';
            config.exceptionRoleIds = (exceptionRoleIds ?? '')
                .split('\n')
                .map(item => item.trim())
                .filter(item => item.length > 0);
            const messageCounter = await (0, config_1.getMessageCounter)(configId);
            for (let value of Object.values(messageCounter)) {
                if (value) {
                    value.warned = false;
                }
            }
            await (0, config_1.saveMessageCounter)(configId, messageCounter);
            await (0, config_1.setConfigForId)(configId, config);
            await submitInteraction.followUp({
                content: '',
                embeds: [
                    new discord_js_1.EmbedBuilder()
                        .setDescription(`Updated.\n\n${(0, GetMessageLimitsMessage_1.getMessageLimitsMessage)(config)}`)
                        .setColor(0x00ff00)
                ],
                components: [],
            });
        }
        else {
            throw new Error('Invalid values provided.');
        }
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
//# sourceMappingURL=MessageLimitsModal.js.map