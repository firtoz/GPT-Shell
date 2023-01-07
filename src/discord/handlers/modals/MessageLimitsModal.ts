import {defineModal} from "../DefineModal";
import {EmbedBuilder, ModalSubmitInteraction, TextInputStyle} from "discord.js";
import {
    getConfig,
    getConfigForId,
    getMessageCounter,
    saveMessageCounter,
    setConfig,
    setConfigForId
} from "../../../core/config";
import {parseInt} from "lodash";
import {retrieveConversation} from "../../../core/RetrieveConversation";
import {getConfigIdForInteraction} from "../commands/ConfigCommand";
import {getMessageLimitsMessage} from "../commands/GetMessageLimitsMessage";

export const MessageLimitsModal = defineModal(
    'MESSAGE-LIMIT-MODAL',
    'Message Limits',
    {
        label: 'Change Message Limits',
        textOnClick: 'Updating Message Limits...',
    },
    [
        {
            name: 'maxMessagePerUser',
            label: 'Max Messages Allowed for Non-API Key Users',
            defaultValue: '-1',
            placeholder: '-1',
            required: true,
            style: TextInputStyle.Short,
        },
        {
            name: 'maxImagePerUser',
            label: 'Max Image Generations for Non-API Key Users',
            defaultValue: '-1',
            placeholder: '-1',
            required: true,
            style: TextInputStyle.Short,
        },
        {
            name: 'messageExpiredNote',
            label: 'Additional Note For users',
            defaultValue: '',
            placeholder: 'Please contact a server admin to get access for unlimited messages.',
            required: false,
            style: TextInputStyle.Short,
        },
        {
            name: 'exceptionRoleIds',
            label: 'Exception Role Ids',
            defaultValue: '',
            placeholder: '[ID1]\n[ID2]',
            required: false,
            style: TextInputStyle.Paragraph,
        }], async (interaction) => {
        const {configId} = await getConfigIdForInteraction(interaction);
        if (!configId) {
            throw new Error('No config id found for interaction...');
        }

        const config = await getConfigForId(configId);

        return {
            maxMessagePerUser: `${config.maxMessagePerUser}`,
            maxImagePerUser: `${config.maxImagePerUser}`,
            exceptionRoleIds: `${config.exceptionRoleIds.join('\n')}`,
            messageExpiredNote: config.messageExpiredNote,
        };
    },
    async (values, submitInteraction) => {
        try {
            const {configId} = await getConfigIdForInteraction(submitInteraction);
            if (!configId) {
                throw new Error('No config id found for interaction...');
            }

            const config = await getConfigForId(configId);

            const {
                maxMessagePerUser,
                maxImagePerUser,
                exceptionRoleIds,
                messageExpiredNote,
            } = values;

            const maxMessagePerUserValue = parseInt(maxMessagePerUser ?? '-1');
            const maxImagePerUserValue = parseInt(maxImagePerUser ?? '-1');

            if (!isNaN(maxMessagePerUserValue)) {
                config.maxMessagePerUser = maxMessagePerUserValue < 0 ? -1 : maxMessagePerUserValue;
                config.maxImagePerUser = maxImagePerUserValue < 0 ? -1 : maxImagePerUserValue;
                config.messageExpiredNote = messageExpiredNote ?? '';
                config.exceptionRoleIds = (exceptionRoleIds ?? '')
                    .split('\n')
                    .map(item => item.trim())
                    .filter(item => item.length > 0);

                const messageCounter = await getMessageCounter(configId);
                for (let value of Object.values(messageCounter)) {
                    if (value) {
                        value.warned = false;
                    }
                }

                await saveMessageCounter(configId, messageCounter);

                await setConfigForId(configId, config);

                await submitInteraction.followUp({
                    content: '',
                    embeds: [
                        new EmbedBuilder()
                            .setDescription(`Updated.\n\n${getMessageLimitsMessage(config)}`)
                            .setColor(0x00ff00)
                    ],
                    components: [],
                });
            } else {
                throw new Error('Invalid values provided.');
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

