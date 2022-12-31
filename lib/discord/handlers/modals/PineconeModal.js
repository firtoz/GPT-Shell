"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PineconeModal = void 0;
const config_1 = require("../../../core/config");
const discord_js_1 = require("discord.js");
const DefineModal_1 = require("../DefineModal");
const pinecone_1 = require("../../../core/pinecone");
const pineconModalId = 'SET-PINECONE-MODAL';
exports.PineconeModal = (0, DefineModal_1.defineModal)(pineconModalId, 'Pinecone Options', {
    label: 'Update Pinecone Options',
    textOnClick: 'Updating Pinecone Options...',
}, [{
        name: 'apiKey',
        label: 'API Key',
        defaultValue: '',
        placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        required: false,
        style: discord_js_1.TextInputStyle.Short,
    }, {
        name: 'baseUrl',
        label: 'Base URL',
        defaultValue: '',
        placeholder: 'https://xxxxxxxxx-xxxxxxx.svc.xxxxx.pinecone.io/',
        required: false,
        style: discord_js_1.TextInputStyle.Short,
    }, {
        name: 'namespace',
        label: 'Namespace',
        defaultValue: '',
        placeholder: 'example-namespace',
        required: false,
        style: discord_js_1.TextInputStyle.Short,
    }], async () => {
    const config = await (0, config_1.getConfig)();
    return config.pineconeOptions ?? {
        apiKey: '',
        baseUrl: '',
        namespace: '',
    };
}, async (values, submitInteraction) => {
    try {
        const { apiKey, baseUrl, namespace } = values;
        if (apiKey == '' && baseUrl == '' && namespace == '') {
            await (0, pinecone_1.trySavingPineconeOptions)(null);
            await submitInteraction.editReply({
                content: '',
                embeds: [
                    new discord_js_1.EmbedBuilder()
                        .setDescription('Removed pinecone connection.')
                        .setColor(0x00ff00)
                ],
                components: [],
            });
            return;
        }
        const saveResult = await (0, pinecone_1.trySavingPineconeOptions)({
            apiKey,
            baseUrl,
            namespace,
        });
        if (saveResult.success) {
            await submitInteraction.editReply({
                content: '',
                embeds: [
                    new discord_js_1.EmbedBuilder()
                        .setDescription('Successfully saved pinecone connection.')
                        .setColor(0x00ff00)
                ],
                components: [],
            });
        }
        else {
            await submitInteraction.followUp({
                content: '',
                embeds: [
                    new discord_js_1.EmbedBuilder()
                        .setDescription(`Could not save.Error:
${saveResult.message}`)
                        .setColor(0xff0000),
                ],
                components: [],
            });
        }
    }
    catch (e) {
        await submitInteraction.followUp({
            content: 'Failure to save pinecone config...',
            embeds: e.message ? [
                new discord_js_1.EmbedBuilder()
                    .setDescription(e.message)
                    .setColor(0xff0000)
            ] : [],
            components: [],
        });
    }
});
//# sourceMappingURL=PineconeModal.js.map