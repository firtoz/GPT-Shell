"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrivateChatGptCommand = exports.ChatGptCommand = void 0;
const discord_js_1 = require("discord.js");
const GetEnv_1 = require("../../../utils/GetEnv");
const logMessage_1 = require("../../../utils/logMessage");
const discordClient_1 = require("../../discordClient");
const GetMissingAPIKeyResponse_1 = require("../../../utils/GetMissingAPIKeyResponse");
const GetDateString_1 = require("../../../utils/GetDateString");
const GetOpenAIForId_1 = require("../../../core/GetOpenAIForId");
const TrySendingMessage_1 = require("../../../core/TrySendingMessage");
const ConversationFactory_1 = require("../../../core/ConversationFactory");
const RetrieveConversation_1 = require("../../../core/RetrieveConversation");
const ChatGPTConversation_1 = require("../../../core/ChatGPTConversation");
const COMMAND_NAME = (0, GetEnv_1.getEnv)('COMMAND_NAME');
const PRIVATE_COMMAND_NAME = (0, GetEnv_1.getEnv)('PRIVATE_COMMAND_NAME');
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
async function handleChat(interaction, client, model, isPrivate = false) {
    if (!interaction.inGuild()) {
        return;
    }
    let openAI = await (0, GetOpenAIForId_1.getOpenAIForId)(interaction.guildId);
    if (!openAI) {
        if (!openAI) {
            // fallback to user's key...
            openAI = await (0, GetOpenAIForId_1.getOpenAIForId)(interaction.user.id);
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
    if (isPrivate) {
        message = await interaction.followUp({
            ephemeral: true,
            embeds: [
                new discord_js_1.EmbedBuilder()
                    .setDescription('Creating new private thread...'),
            ]
        });
    }
    else if (channel?.isThread()) {
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
        const threadName = `${user.username} - ${value ?? (0, GetDateString_1.getDateString)(new Date())}`
            .substring(0, 80);
        if (isPrivate) {
            const messageChannel = await discordClient_1.discordClient.channels.fetch(message.channelId);
            if (messageChannel && messageChannel instanceof discord_js_1.TextChannel) {
                const privateThread = await messageChannel.threads.create({
                    name: threadName,
                    reason: 'ChatGPT',
                    autoArchiveDuration: discord_js_1.ThreadAutoArchiveDuration.OneHour,
                    type: discord_js_1.ChannelType.PrivateThread,
                });
                await privateThread.members.add(userId);
                await interaction.followUp({
                    ephemeral: true,
                    embeds: [new discord_js_1.EmbedBuilder()
                            .setTitle('Created Private Thread')
                            .setDescription(`Link: <#${privateThread.id}>.`)
                    ]
                });
                thread = privateThread;
            }
            else {
                return;
            }
        }
        else {
            thread = await message.startThread({
                name: threadName,
                reason: 'ChatGPT',
                autoArchiveDuration: discord_js_1.ThreadAutoArchiveDuration.OneHour,
            });
        }
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
        (0, logMessage_1.logMessage)(`Cannot create thread in <#${message.channelId}> of ${message.guild?.name}.`, e);
        return;
    }
    const conversation = ConversationFactory_1.ConversationFactory.create(thread.id, userId, interaction.guildId, discordClient_1.discordClient.user.username, model);
    const existingConvo = await (0, RetrieveConversation_1.retrieveConversation)(interaction.channelId);
    if (existingConvo && existingConvo.version == ChatGPTConversation_1.ChatGPTConversation.latestVersion) {
        conversation.username = existingConvo.username;
        conversation.customPrompt = existingConvo.customPrompt;
        conversation.temperature = existingConvo.temperature;
    }
    await conversation.persist();
    (0, logMessage_1.logMessage)(`New thread by <@${user.id}> in ${await conversation.getLinkableId()}.`);
    if (inputValue != null) {
        await conversation.handlePrompt(user, thread, inputValue);
    }
    await (0, TrySendingMessage_1.trySendingMessage)(thread, { content: `[[<@${userId}>, ${conversation.username} will respond to your messages in this thread.]]` }, undefined);
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
exports.PrivateChatGptCommand = PRIVATE_COMMAND_NAME ? {
    name: PRIVATE_COMMAND_NAME,
    dmPermission: false,
    ephemeral: true,
    description: "Starts a private chat",
    type: discord_js_1.ApplicationCommandType.ChatInput,
    options,
    run: async (client, interaction) => {
        const model = 'text-davinci-003';
        await handleChat(interaction, client, model, true);
    }
} : null;
//# sourceMappingURL=ChatGptCommand.js.map