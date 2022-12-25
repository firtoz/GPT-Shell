import {ButtonCommand} from "../Command";
import {getConfig} from "../../core/config";
import {v4} from "uuid";
import {ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle} from "discord.js";

const pineconeButtonId = 'SET-PINECONE-BUTTON';
export const PineconeButtonCommand: ButtonCommand = {
    id: pineconeButtonId,
    async run(client, buttonInteraction) {
        const config = await getConfig();

        const modalId = v4();

        const API_KEY_INPUT_ID = 'apiKeyInput';
        const BASE_URL_INPUT_ID = 'baseUrlInput';
        const NAMESPACE_INPUT_ID = 'namespaceInput';

        {
            {
                const modal = new ModalBuilder()
                    .setCustomId(modalId)
                    .setTitle('Pinecone Options');

                let options = config.pineconeOptions ?? {
                    apiKey: '',
                    baseUrl: '',
                    namespace: '',
                };

                // Add components to modal

                // Create the text input components
                const apiKeyInput = new TextInputBuilder()
                    .setCustomId(API_KEY_INPUT_ID)
                    .setLabel("API Key")
                    .setValue(options.apiKey ?? '')
                    .setPlaceholder('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx')
                    .setRequired(false)
                    .setStyle(TextInputStyle.Short);

                const baseURLInput = new TextInputBuilder()
                    .setCustomId(BASE_URL_INPUT_ID)
                    .setLabel("Base URL")
                    .setValue(options.baseUrl ?? '')
                    .setPlaceholder('https://xxxxxxxxx-xxxxxxx.svc.xxxxx.pinecone.io/')
                    .setRequired(false)
                    .setStyle(TextInputStyle.Short);

                const namespaceInput = new TextInputBuilder()
                    .setCustomId(NAMESPACE_INPUT_ID)
                    .setLabel("Namespace")
                    .setValue(options.namespace ?? '')
                    .setPlaceholder('exampleNamespace')
                    .setRequired(false)
                    .setStyle(TextInputStyle.Short);

                // Add inputs to the modal
                modal.addComponents([
                    new ActionRowBuilder<TextInputBuilder>().addComponents(apiKeyInput),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(baseURLInput),
                    new ActionRowBuilder<TextInputBuilder>().addComponents(namespaceInput),
                ]);

                // Show the modal to the user
                await buttonInteraction.showModal(modal);
            }

//             await buttonInteraction.awaitModalSubmit({filter: i => i.customId === modalId, time: 15_000})
//                 .then(async submitInteraction => {
//                     await submitInteraction.deferReply({
//                         ephemeral: true,
//                     });
//
//                     try {
//                         const apiKey = submitInteraction.fields.getTextInputValue(API_KEY_INPUT_ID);
//                         const baseUrl = submitInteraction.fields.getTextInputValue(BASE_URL_INPUT_ID);
//                         const namespace = submitInteraction.fields.getTextInputValue(NAMESPACE_INPUT_ID);
//
//                         if (apiKey == '' && baseUrl == '' && namespace == '') {
//                             await trySavingPineconeOptions(null);
//
//                             await submitInteraction.deleteReply();
//
//                             await commandInteraction.editReply({
//                                 content: '',
//                                 embeds: [
//                                     new EmbedBuilder()
//                                         .setDescription('Removed pinecone connection.')
//                                         .setColor(0x00ff00)
//                                 ],
//                                 components: [],
//                             });
//
//                             return;
//                         }
//
//                         const saveResult = await trySavingPineconeOptions({
//                             apiKey,
//                             baseUrl,
//                             namespace,
//                         });
//
//                         if (saveResult.success) {
//                             await submitInteraction.deleteReply();
//                             await commandInteraction.editReply({
//                                 content: '',
//                                 embeds: [
//                                     new EmbedBuilder()
//                                         .setDescription('Successfully saved pinecone connection.')
//                                         .setColor(0x00ff00)
//                                 ],
//                                 components: [],
//                             });
//                         } else {
//                             await submitInteraction.followUp({
//                                 content: '',
//                                 embeds: [
//                                     new EmbedBuilder()
//                                         .setDescription(`Could not save.Error:
// ${saveResult.message}`)
//                                         .setColor(0xff0000),
//                                 ],
//                                 components: [],
//                             });
//                         }
//                     } catch (e: any) {
//                         await submitInteraction.followUp({
//                             content: 'Failure to save pinecone config...',
//                             embeds: e.message ? [
//                                 new EmbedBuilder()
//                                     .setDescription(e.message)
//                                     .setColor(0xff0000)
//                             ] : [],
//                             components: [],
//                         });
//                     }
//
//
//                 })
//                 .catch(console.error);

        }

    }
}
