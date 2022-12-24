"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatGptCommand = void 0;
const discord_js_1 = require("discord.js");
const GetEnv_1 = require("../../utils/GetEnv");
const logMessage_1 = require("../../utils/logMessage");
const discordClient_1 = require("../discordClient");
const GetMissingAPIKeyResponse_1 = require("../../utils/GetMissingAPIKeyResponse");
const GetDateString_1 = require("../../utils/GetDateString");
const GetOpenAIKeyForId_1 = require("../../core/GetOpenAIKeyForId");
const TrySendingMessage_1 = require("../../core/TrySendingMessage");
const ConversationFactory_1 = require("../../core/ConversationFactory");
const COMMAND_NAME = (0, GetEnv_1.getEnv)('COMMAND_NAME');
if (COMMAND_NAME == null) {
    throw new Error('No command name?');
}
const options = [
    {
        name: 'input',
        type: discord_js_1.ApplicationCommandOptionType.String,
        description: 'Text input.',
        required: false,
    }
];
async function handleChat(interaction, client, model) {
    if (!interaction.inGuild()) {
        return;
    }
    let openAI = await (0, GetOpenAIKeyForId_1.getOpenAIKeyForId)(interaction.guildId);
    if (!openAI) {
        if (!openAI) {
            // fallback to user's key...
            openAI = await (0, GetOpenAIKeyForId_1.getOpenAIKeyForId)(interaction.user.id);
        }
        if (!openAI) {
            (0, logMessage_1.logMessage)(`Could not find API key for server ${await (0, discordClient_1.getGuildName)(interaction.guildId)}[${interaction.guildId}}] or user [[${interaction.user.username}|${interaction.user.id}]]`);
            await interaction.followUp(await (0, GetMissingAPIKeyResponse_1.getMissingAPIKeyResponse)(false));
            const MAIN_SERVER_INVITE = (0, GetEnv_1.getEnv)('MAIN_SERVER_INVITE');
            if (MAIN_SERVER_INVITE) {
                await interaction.followUp({
                    content: `${MAIN_SERVER_INVITE}`,
                });
            }
            return;
        }
    }
    const inputOption = interaction.options.get('input');
    const value = inputOption?.value;
    const user = interaction.user;
    const userId = user.id;
    const firstMessage = `${value ? `<@${userId}>: ${value}` : `Chat with <@${userId}>`}`;
    if (!interaction.channel) {
        await discordClient_1.discordClient.channels.fetch(interaction.channelId);
    }
    const inputValue = inputOption?.value;
    const threadName = `${user.username} - ${value ?? (0, GetDateString_1.getDateString)(new Date())}`
        .substring(0, 80);
    let thread;
    let message;
    const channel = interaction.channel;
    const embeds = [
        new discord_js_1.EmbedBuilder()
            .setAuthor({
            name: user.username,
            iconURL: user.avatarURL() ?? undefined,
        })
            .setDescription(firstMessage),
    ];
    let referenceThreadHere = null;
    if (channel?.isThread()) {
        referenceThreadHere = await interaction.followUp({
            options: {
                username: user.username,
                avatarURL: user.avatarURL() ?? '',
            },
            embeds: [
                new discord_js_1.EmbedBuilder()
                    .setDescription('Creating new thread in channel...'),
            ]
        });
        const starterMessage = await channel.fetchStarterMessage();
        if (starterMessage != null) {
            message = await starterMessage.reply({
                content: `Thread spun off from <#${channel.id}>: `,
                embeds
            });
        }
        else {
            message = await channel.send({
                content: `Thread spun off from <#${channel.id}>: `,
                embeds,
            });
        }
    }
    else {
        message = await interaction.followUp({
            embeds,
        });
    }
    try {
        thread = await message.startThread({
            name: threadName,
            reason: 'ChatGPT',
            autoArchiveDuration: discord_js_1.ThreadAutoArchiveDuration.OneHour,
        });
        if (referenceThreadHere != null) {
            await referenceThreadHere.edit({
                embeds: [
                    new discord_js_1.EmbedBuilder()
                        .setDescription(`Created spinoff: <#${thread.id}>.`)
                ]
            });
        }
    }
    catch (e) {
        try {
            await interaction.followUp('Could not create thread... Please ask an admin for permissions!');
        }
        catch (e) {
            (0, logMessage_1.logMessage)(`Cannot even follow up in <#${message.channelId}> of ${message.guild?.name}.`);
        }
        (0, logMessage_1.logMessage)(`Cannot create thread in <#${message.channelId}> of ${message.guild?.name}.`);
        return;
    }
    const conversation = ConversationFactory_1.ConversationFactory.create(thread.id, userId, interaction.guildId, discordClient_1.discordClient.user.username, model);
    await conversation.persist();
    (0, logMessage_1.logMessage)(`New thread by <@${user.id}> in ${await conversation.getLinkableId()}.`);
    if (inputValue != null) {
        await conversation.handlePrompt(user, thread, inputValue);
    }
    else {
        await (0, TrySendingMessage_1.trySendingMessage)(thread, { content: `[[<@${userId}>, ${client.user.username} will respond to your messages in this thread.]]` }, undefined);
    }
}
exports.ChatGptCommand = {
    name: COMMAND_NAME,
    dmPermission: false,
    description: "Starts a chat",
    type: discord_js_1.ApplicationCommandType.ChatInput,
    options,
    run: async (client, interaction) => {
        const model = 'text-davinci-003';
        await handleChat(interaction, client, model);
    }
};
//# sourceMappingURL=ChatGptCommand.js.map