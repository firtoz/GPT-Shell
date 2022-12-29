import {getConfig} from "../../../core/config";
import {EmbedBuilder, TextInputStyle} from "discord.js";
import {defineModal} from "../DefineModal";
import {trySavingPineconeOptions} from "../../../core/pinecone";

const pineconModalId = 'SET-PINECONE-MODAL';

export const PineconeModal = defineModal(
    pineconModalId,
    'Pinecone Options',
    {
        label: 'Update Pinecone Options',
        textOnClick: 'Updating Pinecone Options...',
    },
    [{
        name: 'apiKey',
        label: 'API Key',
        defaultValue: '',
        placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
        required: false,
        style: TextInputStyle.Short,
    }, {
        name: 'baseUrl',
        label: 'Base URL',
        defaultValue: '',
        placeholder: 'https://xxxxxxxxx-xxxxxxx.svc.xxxxx.pinecone.io/',
        required: false,
        style: TextInputStyle.Short,
    }, {
        name: 'namespace',
        label: 'Namespace',
        defaultValue: '',
        placeholder: 'example-namespace',
        required: false,
        style: TextInputStyle.Short,
    }], async () => {
        const config = await getConfig();

        return config.pineconeOptions ?? {
            apiKey: '',
            baseUrl: '',
            namespace: '',
        };
    },
    async (values, submitInteraction) => {
        try {
            const {apiKey, baseUrl, namespace} = values;

            if (apiKey == '' && baseUrl == '' && namespace == '') {
                await trySavingPineconeOptions(null);

                await submitInteraction.editReply({
                    content: '',
                    embeds: [
                        new EmbedBuilder()
                            .setDescription('Removed pinecone connection.')
                            .setColor(0x00ff00)
                    ],
                    components: [],
                });

                return;
            }

            const saveResult = await trySavingPineconeOptions({
                apiKey,
                baseUrl,
                namespace,
            });

            if (saveResult.success) {
                await submitInteraction.editReply({
                    content: '',
                    embeds: [
                        new EmbedBuilder()
                            .setDescription('Successfully saved pinecone connection.')
                            .setColor(0x00ff00)
                    ],
                    components: [],
                });
            } else {
                await submitInteraction.followUp({
                    content: '',
                    embeds: [
                        new EmbedBuilder()
                            .setDescription(`Could not save.Error:
${saveResult.message}`)
                            .setColor(0xff0000),
                    ],
                    components: [],
                });
            }
        } catch (e: any) {
            await submitInteraction.followUp({
                content: 'Failure to save pinecone config...',
                embeds: e.message ? [
                    new EmbedBuilder()
                        .setDescription(e.message)
                        .setColor(0xff0000)
                ] : [],
                components: [],
            });
        }
    });


