import {defineModal} from "../DefineModal";
import {EmbedBuilder, TextInputStyle} from "discord.js";
import {getConfigForId, setConfigForId} from "../../../core/config";
import {getConfigIdForInteraction} from "../commands/ConfigCommand";

export const ChatChannelsModal = defineModal(
    'CHAT-CHANNELS-MODAL',
    'Chat Channels',
    {
        label: 'Change Chat Channels',
        textOnClick: 'Updating Chat Channels...',
    },
    [{
        name: 'chatChannelIds',
        label: 'Chat Channel Ids',
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
            chatChannelIds: `${config.chatChannelIds.join('\n')}`
        };
    },
    async (values, submitInteraction) => {
        try {
            const {configId} = await getConfigIdForInteraction(submitInteraction);
            if (!configId) {
                throw new Error('No config id found for interaction...');
            }

            const config = await getConfigForId(configId);

            const {chatChannelIds} = values;

            config.chatChannelIds = (chatChannelIds ?? '')
                .split('\n')
                .map(item => item.trim())
                .filter(item => item.length > 0);

            await setConfigForId(configId, config);

            await submitInteraction.followUp({
                content: '',
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`Updated.\n\nChat channels:\n\n${config.chatChannelIds.map(item => `<#${item}>`).join('\n')}`)
                        .setColor(0x00ff00)
                ],
                components: [],
            });
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

