import {defineModal} from "../DefineModal";
import {CommandInteraction, EmbedBuilder, MessageComponentInteraction, TextInputStyle} from "discord.js";
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
        required: false,
        style: TextInputStyle.Short,
    }, {
        name: 'customPrompt',
        label: 'Custom Prompt',
        defaultValue: '',
        placeholder: '',
        required: false,
        style: TextInputStyle.Paragraph,
    }, {
        name: 'temperature',
        label: 'Temperature',
        defaultValue: '0.8',
        placeholder: '0 -> 1',
        required: false,
        style: TextInputStyle.Paragraph,
    }, {
        name: 'showUsername',
        label: 'Show Username (true/false)',
        defaultValue: 'true',
        placeholder: 'true/false',
        required: true,
        style: TextInputStyle.Short,
    }, {
        name: 'makePrivate',
        label: 'Private Only',
        defaultValue: 'false',
        placeholder: 'true/false',
        required: true,
        style: TextInputStyle.Short,
        shouldShow: (interaction: MessageComponentInteraction | CommandInteraction) => {
            const channel = interaction.channel;
            if (channel) {
                if (channel.isDMBased()) {
                    return false;
                }

                if (channel.isThread()) {
                    return false;
                }
            }

            return true;
        }
    }], async (interaction) => {
        const conversation = await retrieveConversation(interaction.channelId) as ChatGPTConversation | null;

        if (conversation) {
            return {
                customUsername: conversation.username ?? discordClient.user!.username,
                customPrompt: conversation.customPrompt ?? ' ',
                temperature: conversation.temperature === undefined ? '0.8' : `${conversation.temperature}`,
                showUsername: `${conversation.showUsername}`,
                makePrivate: `${Boolean(conversation.makePrivate)}`,
            };
        }

        return {
            customUsername: discordClient.user!.username,
            customPrompt: ' ',
            temperature: '0.8',
            showUsername: 'true',
            makePrivate: 'false',
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

            if (values.customUsername && values.customUsername.trim().length > 0) {
                conversation.username = values.customUsername;
            } else {
                conversation.username = discordClient.user!.username;
            }
            if (values.customPrompt && values.customPrompt.trim().length > 0) {
                conversation.customPrompt = values.customPrompt;
            } else {
                conversation.customPrompt = '';
            }
            let temperature = conversation.temperature;
            if (values.temperature !== undefined && values.temperature.length > 0) {
                temperature = parseFloat(values.temperature);

                if (isNaN(temperature)) {
                    temperature = conversation.temperature;
                }
            } else {
                temperature = 0.8;
            }

            conversation.temperature = Math.min(Math.max(temperature, 0), 1);

            conversation.showUsername = values.showUsername !== 'false';
            conversation.makePrivate = values.makePrivate === 'true';

            await conversation.persist();

            await submitInteraction.followUp({
                content: '',
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`Updated.

Try speaking to ${conversation.username!}!`)
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
