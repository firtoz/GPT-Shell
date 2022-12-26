import {defineModal} from "./DefineModal";
import {EmbedBuilder, TextInputStyle} from "discord.js";
import {getConfig, setConfig} from "../../core/config";
import {Configuration, OpenAIApi} from "openai";
import {OpenAICache} from "../../core/GetOpenAIForId";
import {mainServerId} from "../../core/MainServerId";
import {AxiosError} from "axios";
import {logMessage} from "../../utils/logMessage";

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

                    config.openAIApiKey = apiKey;

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
