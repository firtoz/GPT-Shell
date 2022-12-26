import {defineModal} from "./DefineModal";
import {EmbedBuilder, TextInputStyle} from "discord.js";
import {getConfig, setConfig} from "../../core/config";
import {parseInt} from "lodash";

export const TokenLimitsModal = defineModal(
    'TOKEN-LIMIT-MODAL',
    'Token Limits',
    [{
        name: 'maxTokensForRecentMessages',
        label: 'Tokens for Recent Messages',
        defaultValue: '',
        placeholder: '',
        required: false,
        style: TextInputStyle.Short,
    }, {
        name: 'maxAllowedTokens',
        label: 'Max Total Tokens Per Msg',
        defaultValue: '',
        placeholder: '',
        required: false,
        style: TextInputStyle.Short,
    }], async () => {
        const config = await getConfig();

        return {
            maxTokensForRecentMessages: `${config.maxTokensForRecentMessages || 0}`,
            maxAllowedTokens: `${config.modelInfo['text-davinci-003'].MAX_ALLOWED_TOKENS || 0}`,
        };
    },
    async (values, submitInteraction) => {
        try {
            const {maxTokensForRecentMessages, maxAllowedTokens} = values;

            const config = await getConfig();

            const maxTokensForRecentMessagesValue = parseInt(maxTokensForRecentMessages ?? '0');
            const maxAllowedTokensValue = parseInt(maxAllowedTokens ?? '0');

            if (!isNaN(maxTokensForRecentMessagesValue) && !isNaN(maxAllowedTokensValue)) {
                config.maxTokensForRecentMessages = maxTokensForRecentMessagesValue;
                config.modelInfo['text-davinci-003'].MAX_ALLOWED_TOKENS = maxAllowedTokensValue;

                await setConfig(config);

                await submitInteraction.followUp({
                    content: '',
                    embeds: [
                        new EmbedBuilder()
                            .setDescription(`Updated token limits to [${maxTokensForRecentMessagesValue}, ${maxAllowedTokensValue}]!`)
                            .setColor(0x00ff00)
                    ],
                    components: [],
                });
            } else {
                throw new Error('Invalid values provided, use only integers please.');
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

