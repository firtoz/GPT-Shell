"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModerationsModal = exports.moderationResultToString = void 0;
const DefineModal_1 = require("../DefineModal");
const discord_js_1 = require("discord.js");
const config_1 = require("../../../core/config");
function moderationResultToString(moderationThreshold) {
    return JSON.stringify(Object.fromEntries(Object.entries(moderationThreshold).map(([key, value]) => [key, value.toFixed(2)])), null, '  ');
}
exports.moderationResultToString = moderationResultToString;
exports.ModerationsModal = (0, DefineModal_1.defineModal)('MODERATIONS-MODAL', 'Moderations', {
    label: 'Change Moderation Thresholds',
    textOnClick: 'Updating Moderation Thresholds...',
}, [{
        name: 'moderationThresholds',
        label: 'Moderation Thresholds',
        defaultValue: moderationResultToString((0, config_1.getDefaultModerationThresholds)()),
        placeholder: 'JSON OBJECT',
        required: false,
        style: discord_js_1.TextInputStyle.Paragraph,
    }], async () => {
    const config = await (0, config_1.getConfig)();
    return {
        moderationThresholds: JSON.stringify(config.moderationThreshold, null, '  ')
    };
}, async (values, submitInteraction) => {
    try {
        const config = await (0, config_1.getConfig)();
        const { moderationThresholds } = values;
        const fromJSON = JSON.parse(moderationThresholds);
        Object
            .entries(config.moderationThreshold)
            .map(([key]) => {
            const keyToUse = key;
            const newValue = fromJSON[keyToUse];
            if (isNaN(newValue) || newValue < 0 || newValue > 1) {
                throw new Error(`Cannot set ${key}: invalid value ${newValue}, needs to be a number between 0 and 1`);
            }
            config.moderationThreshold[keyToUse] = newValue;
        });
        await (0, config_1.setConfig)(config);
        await submitInteraction.followUp({
            content: '',
            embeds: [
                new discord_js_1.EmbedBuilder()
                    .setDescription(`Updated.

New moderation thresholds:

\`\`\`json
${(moderationResultToString(config.moderationThreshold))}
\`\`\`
`)
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
//# sourceMappingURL=ModerationsModal.js.map