import {defineModal} from "./DefineModal";
import {EmbedBuilder, TextInputStyle} from "discord.js";
import {getConfig, setConfig} from "../../core/config";
import {parseInt} from "lodash";
import {Configuration, OpenAIApi} from "openai";
import {OpenAICache} from "../../core/GetOpenAIForId";
import {mainServerId} from "../../core/MainServerId";
import {logMessage} from "../../utils/logMessage";
import {getGuildName} from "../discordClient";
import {AxiosError} from "axios";

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

export const OpenAIAPIKeyModal = defineModal(
    'OPENAI-API-KEY-MODAL',
    'OpenAI API Key',
    [{
        name: 'apiKey',
        label: 'API Key',
        defaultValue: '',
        placeholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxx',
        required: true,
        style: TextInputStyle.Short,
    }], async () => {
        const config = await getConfig();

        return {
            apiKey: config.openAIApiKey ?? '',
        };
    },
    async (values, submitInteraction) => {
        try {
            const {apiKey} = values;

            const config = await getConfig();

            if (apiKey == null || apiKey.length < 2) {
                throw new Error(`Invalid token supplied: '${apiKey}'.`);
            }

            const api = new OpenAIApi(new Configuration({
                apiKey,
            }));

            try {
                const models = await api.listModels();
                const data = models.data;

                if (data != null) {
                    OpenAICache[mainServerId] = api;

                    await setConfig(config);

                    await submitInteraction.followUp({
                        content: '',
                        embeds: [
                            new EmbedBuilder()
                                .setDescription(`Updated OpenAI API key!`)
                                .setColor(0x00ff00)
                        ],
                        components: [],
                    });
                }
            } catch (e) {
                const err = e as AxiosError;

                logMessage({apiKey, status: err.status, data: err.response?.data})

                throw new Error('Bad token supplied.');
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
