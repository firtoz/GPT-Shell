import {CreateModerationResponseResultsInnerCategoryScores} from "openai";
import {defineModal} from "../DefineModal";
import {EmbedBuilder, TextInputStyle} from "discord.js";
import {getConfig, getDefaultModerationThresholds, setConfig} from "../../../core/config";

export function moderationResultToString(moderationThreshold: CreateModerationResponseResultsInnerCategoryScores) {
    return JSON.stringify(Object.fromEntries(Object.entries(moderationThreshold).map(([key, value]) => [key, value.toFixed(2)])), null, '  ');
}

export const ModerationsModal = defineModal(
    'MODERATIONS-MODAL',
    'Moderations',
    {
        label: 'Change Moderation Thresholds',
        textOnClick: 'Updating Moderation Thresholds...',
    },
    [{
        name: 'moderationThresholds',
        label: 'Moderation Thresholds',
        defaultValue: moderationResultToString(getDefaultModerationThresholds()),
        placeholder: 'JSON OBJECT',
        required: false,
        style: TextInputStyle.Paragraph,
    }], async () => {
        const config = await getConfig();

        return {
            moderationThresholds: JSON.stringify(
                config.moderationThreshold,
                null,
                '  '
            )
        };
    },
    async (values, submitInteraction) => {
        try {
            const config = await getConfig();

            const {moderationThresholds} = values;

            const fromJSON: CreateModerationResponseResultsInnerCategoryScores = JSON.parse(moderationThresholds!);

            Object
                .entries(config.moderationThreshold)
                .map(([key]) => {
                    const keyToUse = key as keyof CreateModerationResponseResultsInnerCategoryScores;
                    const newValue = fromJSON[keyToUse];

                    if (isNaN(newValue) || newValue < 0 || newValue > 1) {
                        throw new Error(`Cannot set ${key}: invalid value ${newValue}, needs to be a number between 0 and 1`);
                    }

                    config.moderationThreshold[keyToUse] = newValue;
                });

            await setConfig(config);

            await submitInteraction.followUp({
                content: '',
                embeds: [
                    new EmbedBuilder()
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
        } catch (e: any) {
            await submitInteraction.followUp({
                content: 'Failure to save',
                embeds: e.message ? [
                    new EmbedBuilder()
                        .setDescription(e.message)
                        .setColor(0xff0000)
                ] : [],
                components: [],
            });
        }
    });
