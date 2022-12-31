"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIAPIKeyModal = void 0;
const DefineModal_1 = require("../DefineModal");
const discord_js_1 = require("discord.js");
const config_1 = require("../../../core/config");
const openai_1 = require("openai");
const GetOpenAIForId_1 = require("../../../core/GetOpenAIForId");
const logMessage_1 = require("../../../utils/logMessage");
const ConfigCommand_1 = require("../commands/ConfigCommand");
const discordClient_1 = require("../../discordClient");
exports.OpenAIAPIKeyModal = (0, DefineModal_1.defineModal)('OPENAI-API-KEY-MODAL', 'OpenAI API Key', {
    textOnClick: 'Updating OpenAI API Key...',
    label: 'Change OpenAI API Key',
}, [{
        name: 'apiKey',
        label: 'API Key',
        defaultValue: '',
        placeholder: 'sk-xxxxxxxxxxxxxxxxxxxxxxxxxxx',
        required: false,
        style: discord_js_1.TextInputStyle.Short,
    }], async (interaction) => {
    const { configId } = await (0, ConfigCommand_1.getConfigIdForInteraction)(interaction);
    if (!configId) {
        throw new Error('No config id found for interaction...');
    }
    const config = await (0, config_1.getConfigForId)(configId);
    return {
        apiKey: config.openAIApiKey ?? '',
    };
}, async (values, submitInteraction) => {
    try {
        const { apiKey } = values;
        const { configId, isDM } = await (0, ConfigCommand_1.getConfigIdForInteraction)(submitInteraction);
        if (!configId) {
            throw new Error('No config id found for interaction...');
        }
        if (apiKey == null || apiKey.length === 0) {
            delete GetOpenAIForId_1.OpenAICache[configId];
            const config = await (0, config_1.getConfigForId)(configId);
            config.openAIApiKey = null;
            await (0, config_1.setConfigForId)(configId, config);
            await submitInteraction.followUp({
                content: '',
                embeds: [
                    new discord_js_1.EmbedBuilder()
                        .setDescription(`Removed OpenAI API key for [${isDM ? `User:${submitInteraction.user.tag}` :
                        `Server:${await (0, discordClient_1.getGuildName)(configId)}`}].`)
                        .setColor(0x00ff00)
                ],
                components: [],
            });
            return;
        }
        const api = new openai_1.OpenAIApi(new openai_1.Configuration({
            apiKey,
        }));
        try {
            const models = await api.listModels();
            const data = models.data;
            if (data != null) {
                (0, logMessage_1.logMessage)(`GOOD token supplied for [${isDM ? `User:${submitInteraction.user.tag}` :
                    `Server:${await (0, discordClient_1.getGuildName)(configId)}`}]`);
                GetOpenAIForId_1.OpenAICache[configId] = api;
                const config = await (0, config_1.getConfigForId)(configId);
                config.openAIApiKey = apiKey;
                await (0, config_1.setConfigForId)(configId, config);
                await submitInteraction.followUp({
                    content: '',
                    embeds: [
                        new discord_js_1.EmbedBuilder()
                            .setDescription(`Updated OpenAI API key for [${isDM ? `User:${submitInteraction.user.tag}` :
                            `Server:${await (0, discordClient_1.getGuildName)(configId)}`}]!`)
                            .setColor(0x00ff00)
                    ],
                    components: [],
                });
            }
        }
        catch (e) {
            const err = e;
            (0, logMessage_1.logMessage)({ apiKey, status: err.status, data: err.response?.data });
            throw new Error('Bad token supplied.');
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
//# sourceMappingURL=OpenAIAPIKeyModal.js.map