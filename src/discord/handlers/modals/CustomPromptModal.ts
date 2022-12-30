import {defineModal} from "../DefineModal";
import {EmbedBuilder, TextInputStyle} from "discord.js";
import {retrieveConversation} from "../../../core/RetrieveConversation";
import {ChatGPTConversation} from "../../../core/ChatGPTConversation";
import {discordClient} from "../../discordClient";
import {MultiMessage} from "../../../shared/MultiMessage";

export const CustomPromptModal = defineModal(
    'CUSTOM-PROMPT-MODAL',
    'Custom Prompt',
    null,
    [{
        name: 'customUsername',
        label: 'Custom Username',
        defaultValue: '',
        placeholder: '',
        required: true,
        style: TextInputStyle.Short,
        minLength: 2,
        maxLength: 40,
    }, {
        name: 'customPrompt',
        label: 'Custom Prompt',
        defaultValue: '',
        placeholder: '',
        required: true,
        style: TextInputStyle.Paragraph,
    }], async (interaction) => {
        const conversation = await retrieveConversation(interaction.channelId) as ChatGPTConversation | null;

        if (conversation) {
            return {
                customUsername: conversation.username ?? '',
                customPrompt: conversation.customPrompt ?? '',
            };
        }

        return {
            customUsername: discordClient.user!.username,
            customPrompt: '',
        };
    },
    async (values, submitInteraction) => {
        try {
            const channelId = submitInteraction.channelId;

            if (!channelId) {
                return;
            }

            const channel = await discordClient.channels.fetch(channelId);
            if (!channel) {
                return;
            }

            let conversation = await retrieveConversation(channelId) as ChatGPTConversation | null;

            if (!conversation) {
                conversation = new ChatGPTConversation(channelId,
                    submitInteraction.user.id,
                    submitInteraction.guildId ?? '',
                    values.customUsername ?? discordClient.user!.username,
                    'text-davinci-003'
                );

                if (channel.isDMBased()) {
                    conversation.isDirectMessage = true;
                }
            }

            if (values.customUsername) {
                conversation.username = values.customUsername;
            }
            if (values.customPrompt) {
                conversation.customPrompt = values.customPrompt;
            }

            await conversation.persist();

            await submitInteraction.followUp({
                content: '',
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`Updated.\n\nTry speaking to ${values.customUsername!}!`)
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
