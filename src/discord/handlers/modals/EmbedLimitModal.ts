import {defineModal} from "../DefineModal";
import {EmbedBuilder, TextInputStyle} from "discord.js";
import {getConfig, setConfig} from "../../../core/config";
import {parseInt} from "lodash";

export const EmbedLimitModal = defineModal(
    'EMBED-LIMIT-MODAL',
    'Embed Limits',
    {
        label: 'Change Embed Limit',
        textOnClick: 'Updating Embed Limit...',
    },
    [{
        name: 'maxMessagesToEmbed',
        label: 'Max Messages To Embed',
        defaultValue: '',
        placeholder: '',
        required: false,
        style: TextInputStyle.Short,
    }], async () => {
        const config = await getConfig();

        return {
            maxMessagesToEmbed: `${config.maxMessagesToEmbed || 0}`,
        };
    },
    async (values, submitInteraction) => {
        try {
            const {maxMessagesToEmbed} = values;

            const config = await getConfig();

            const intValue = parseInt(maxMessagesToEmbed ?? '0');

            if (!isNaN(intValue)) {
                config.maxMessagesToEmbed = intValue;
                await setConfig(config);

                await submitInteraction.followUp({
                    content: '',
                    embeds: [
                        new EmbedBuilder()
                            .setDescription(`Updated embed limit to ${intValue}!`)
                            .setColor(0x00ff00)
                    ],
                    components: [],
                });
            } else {
                throw new Error('Invalid value provided for max messages to embed.');
            }
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

