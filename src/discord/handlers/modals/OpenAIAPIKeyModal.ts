import {defineModal} from "../DefineModal";
import {EmbedBuilder, TextInputStyle} from "discord.js";
import {getConfig, getConfigForId, setConfig, setConfigForId} from "../../../core/config";
import {Configuration, OpenAIApi} from "openai";
import {OpenAICache} from "../../../core/GetOpenAIForId";
import {mainServerId} from "../../../core/MainServerId";
import {AxiosError} from "axios";
import {logMessage} from "../../../utils/logMessage";
import {getConfigIdForInteraction} from "../commands/ConfigCommand";
import {getGuildName} from "../../discordClient";

export const OpenAIAPIKeyModal = defineModal(
    'OPENAI-API-KEY-MODAL',
    'OpenAI API Key',
    {
      textOnClick: 'Updating OpenAI API Key...',
      label: 'Change OpenAI API Key',
    },
    [{
        name: 'apiKey',
        label: 'API Key',
        defaultValue: '',
        placeholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxx',
        required: false,
        style: TextInputStyle.Short,
    }], async (interaction) => {
        const {configId} = await getConfigIdForInteraction(interaction);
        if (!configId) {
            throw new Error('No config id found for interaction...');
        }

        const config = await getConfigForId(configId);

        return {
            apiKey: config.openAIApiKey ?? '',
        };
    },
    async (values, submitInteraction) => {
        try {
            const {apiKey} = values;

            const {configId, isDM} = await getConfigIdForInteraction(submitInteraction);

            if (!configId) {
                throw new Error('No config id found for interaction...');
            }

            if(apiKey == null || apiKey.length === 0) {
                delete OpenAICache[configId];
                const config = await getConfigForId(configId);

                config.openAIApiKey = null;

                await setConfigForId(configId, config);

                await submitInteraction.followUp({
                    content: '',
                    embeds: [
                        new EmbedBuilder()
                            .setDescription(`Removed OpenAI API key for [${isDM ? `User:${submitInteraction.user.tag}`:
                                `Server:${await getGuildName(configId)}`}].`)
                            .setColor(0x00ff00)
                    ],
                    components: [],
                });

                return;
            }

            const api = new OpenAIApi(new Configuration({
                apiKey,
            }));

            try {
                const models = await api.listModels();
                const data = models.data;

                if (data != null) {

                    logMessage(`GOOD token supplied for [${isDM ? `User:${submitInteraction.user.tag}`:
                        `Server:${await getGuildName(configId)}`}]`);

                    OpenAICache[configId] = api;

                    const config = await getConfigForId(configId);

                    config.openAIApiKey = apiKey;

                    await setConfigForId(configId, config);

                    await submitInteraction.followUp({
                        content: '',
                        embeds: [
                            new EmbedBuilder()
                                .setDescription(`Updated OpenAI API key for [${isDM ? `User:${submitInteraction.user.tag}`:
                                    `Server:${await getGuildName(configId)}`}]!`)
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
