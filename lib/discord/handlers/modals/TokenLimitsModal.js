"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TokenLimitsModal = void 0;
const DefineModal_1 = require("../DefineModal");
const discord_js_1 = require("discord.js");
const config_1 = require("../../../core/config");
const lodash_1 = require("lodash");
const ConfigCommand_1 = require("../commands/ConfigCommand");
exports.TokenLimitsModal = (0, DefineModal_1.defineModal)('TOKEN-LIMIT-MODAL', 'Token Limits', {
    label: 'Change Token Limits',
    textOnClick: 'Updating Token Limits...',
}, [{
        name: 'maxTokensForRecentMessages',
        label: 'Tokens for Recent Messages',
        defaultValue: '',
        placeholder: '',
        required: false,
        style: discord_js_1.TextInputStyle.Short,
    }, {
        name: 'maxAllowedTokens',
        label: 'Max Total Tokens Per Msg',
        defaultValue: '',
        placeholder: '',
        required: false,
        style: discord_js_1.TextInputStyle.Short,
    }], async (interaction) => {
    const { configId } = await (0, ConfigCommand_1.getConfigIdForInteraction)(interaction);
    if (!configId) {
        throw new Error('No config id found for interaction...');
    }
    const config = await (0, config_1.getConfigForId)(configId);
    return {
        maxTokensForRecentMessages: `${config.maxTokensForRecentMessages || 0}`,
        maxAllowedTokens: `${config.modelInfo['text-davinci-003'].MAX_ALLOWED_TOKENS || 0}`,
    };
}, async (values, submitInteraction) => {
    try {
        const { configId } = await (0, ConfigCommand_1.getConfigIdForInteraction)(submitInteraction);
        if (!configId) {
            throw new Error('No config id found for interaction...');
        }
        const config = await (0, config_1.getConfigForId)(configId);
        const { maxTokensForRecentMessages, maxAllowedTokens } = values;
        const maxTokensForRecentMessagesValue = (0, lodash_1.parseInt)(maxTokensForRecentMessages ?? '0');
        const maxAllowedTokensValue = (0, lodash_1.parseInt)(maxAllowedTokens ?? '0');
        if (!isNaN(maxTokensForRecentMessagesValue) && !isNaN(maxAllowedTokensValue)) {
            config.maxTokensForRecentMessages = maxTokensForRecentMessagesValue;
            config.modelInfo['text-davinci-003'].MAX_ALLOWED_TOKENS = maxAllowedTokensValue;
            await (0, config_1.setConfigForId)(configId, config);
            await submitInteraction.followUp({
                content: '',
                embeds: [
                    new discord_js_1.EmbedBuilder()
                        .setDescription(`Updated token limits to [${maxTokensForRecentMessagesValue}, ${maxAllowedTokensValue}]!`)
                        .setColor(0x00ff00)
                ],
                components: [],
            });
        }
        else {
            throw new Error('Invalid values provided, use only integers please.');
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
//# sourceMappingURL=TokenLimitsModal.js.map