"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmbedLimitModal = void 0;
const DefineModal_1 = require("../DefineModal");
const discord_js_1 = require("discord.js");
const config_1 = require("../../../core/config");
const lodash_1 = require("lodash");
exports.EmbedLimitModal = (0, DefineModal_1.defineModal)('EMBED-LIMIT-MODAL', 'Embed Limits', {
    label: 'Change Embed Limit',
    textOnClick: 'Updating Embed Limit...',
}, [{
        name: 'maxMessagesToEmbed',
        label: 'Max Messages To Embed',
        defaultValue: '',
        placeholder: '',
        required: false,
        style: discord_js_1.TextInputStyle.Short,
    }], async () => {
    const config = await (0, config_1.getConfig)();
    return {
        maxMessagesToEmbed: `${config.maxMessagesToEmbed || 0}`,
    };
}, async (values, submitInteraction) => {
    try {
        const { maxMessagesToEmbed } = values;
        const config = await (0, config_1.getConfig)();
        const intValue = (0, lodash_1.parseInt)(maxMessagesToEmbed ?? '0');
        if (!isNaN(intValue)) {
            config.maxMessagesToEmbed = intValue;
            await (0, config_1.setConfig)(config);
            await submitInteraction.followUp({
                content: '',
                embeds: [
                    new discord_js_1.EmbedBuilder()
                        .setDescription(`Updated embed limit to ${intValue}!`)
                        .setColor(0x00ff00)
                ],
                components: [],
            });
        }
        else {
            throw new Error('Invalid value provided for max messages to embed.');
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
//# sourceMappingURL=EmbedLimitModal.js.map