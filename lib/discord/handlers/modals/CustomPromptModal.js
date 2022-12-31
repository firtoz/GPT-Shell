"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomPromptModal = void 0;
const DefineModal_1 = require("../DefineModal");
const discord_js_1 = require("discord.js");
const RetrieveConversation_1 = require("../../../core/RetrieveConversation");
const ChatGPTConversation_1 = require("../../../core/ChatGPTConversation");
const discordClient_1 = require("../../discordClient");
exports.CustomPromptModal = (0, DefineModal_1.defineModal)('CUSTOM-PROMPT-MODAL', 'Custom Prompt', null, [{
        name: 'customUsername',
        label: 'Custom Username',
        defaultValue: '',
        placeholder: '',
        required: true,
        style: discord_js_1.TextInputStyle.Short,
        minLength: 2,
        maxLength: 40,
    }, {
        name: 'customPrompt',
        label: 'Custom Prompt',
        defaultValue: '',
        placeholder: '',
        required: true,
        style: discord_js_1.TextInputStyle.Paragraph,
    }, {
        name: 'temperature',
        label: 'Temperature',
        defaultValue: '0.8',
        placeholder: '0 -> 1',
        required: true,
        style: discord_js_1.TextInputStyle.Paragraph,
    }], async (interaction) => {
    const conversation = await (0, RetrieveConversation_1.retrieveConversation)(interaction.channelId);
    if (conversation) {
        return {
            customUsername: conversation.username ?? '',
            customPrompt: conversation.customPrompt ?? '',
            temperature: conversation.temperature === undefined ? '0.8' : `${conversation.temperature}`,
        };
    }
    return {
        customUsername: discordClient_1.discordClient.user.username,
        customPrompt: '',
        temperature: '0.8',
    };
}, async (values, submitInteraction) => {
    try {
        const channelId = submitInteraction.channelId;
        if (!channelId) {
            return;
        }
        const channel = await discordClient_1.discordClient.channels.fetch(channelId);
        if (!channel) {
            return;
        }
        let conversation = await (0, RetrieveConversation_1.retrieveConversation)(channelId);
        if (!conversation) {
            conversation = new ChatGPTConversation_1.ChatGPTConversation(channelId, submitInteraction.user.id, submitInteraction.guildId ?? '', values.customUsername ?? discordClient_1.discordClient.user.username, 'text-davinci-003');
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
        let temperature = conversation.temperature;
        if (values.temperature !== undefined) {
            temperature = parseFloat(values.temperature);
            if (isNaN(temperature)) {
                temperature = conversation.temperature;
            }
        }
        conversation.temperature = Math.min(Math.max(temperature, 0), 1);
        await conversation.persist();
        await submitInteraction.followUp({
            content: '',
            embeds: [
                new discord_js_1.EmbedBuilder()
                    .setDescription(`Updated.

Try speaking to ${values.customUsername}!`)
                    .setColor(0x00ff00)
            ],
            components: [],
        });
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
//# sourceMappingURL=CustomPromptModal.js.map