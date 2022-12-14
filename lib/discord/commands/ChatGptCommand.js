"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatGptCommand = void 0;
const discord_js_1 = require("discord.js");
const GetEnv_1 = require("../../utils/GetEnv");
const ChatGPTConversation_1 = require("../../core/ChatGPTConversation");
const logMessage_1 = require("../../utils/logMessage");
const discordClient_1 = require("../discordClient");
const GetMissingAPIKeyResponse_1 = require("../../utils/GetMissingAPIKeyResponse");
const GetDateString_1 = require("../../utils/GetDateString");
const GetOpenAIKeyForId_1 = require("../../core/GetOpenAIKeyForId");
const TrySendingMessage_1 = require("../../core/TrySendingMessage");
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
    if (!await (0, GetOpenAIKeyForId_1.getOpenAIKeyForId)(interaction.guildId)) {
        await interaction.followUp(await (0, GetMissingAPIKeyResponse_1.getMissingAPIKeyResponse)(false));
        const MAIN_SERVER_INVITE = (0, GetEnv_1.getEnv)('MAIN_SERVER_INVITE');
        if (MAIN_SERVER_INVITE) {
            await interaction.followUp({
                content: `${MAIN_SERVER_INVITE}`,
            });
        }
        return;
    }
    const inputOption = interaction.options.get('input');
    const value = inputOption?.value;
    const user = interaction.user;
    const userId = user.id;
    const firstMessage = `${value ? `<@${userId}>: ${value}` : `Chat with <@${userId}>`}`;
    const message = await interaction.followUp({
        options: {
            username: user.username,
            avatarURL: user.avatarURL() ?? '',
        },
        content: firstMessage,
    });
    const inputValue = inputOption?.value;
    const threadName = `${user.username} - ${value ?? (0, GetDateString_1.getDateString)(new Date())}`
        .substring(0, 80);
    let thread;
    try {
        thread = await message.startThread({
            name: threadName,
            reason: 'ChatGPT',
            autoArchiveDuration: discord_js_1.ThreadAutoArchiveDuration.OneHour,
        });
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
    const threadInfo = new ChatGPTConversation_1.ChatGPTConversation(thread.id, userId, interaction.guildId, discordClient_1.discordClient.user.username, model);
    await threadInfo.persist();
    (0, logMessage_1.logMessage)(`New thread by <@${threadInfo.creatorId}> in [${interaction.guild?.name ?? 'Unknown Server'}]: <#${threadInfo.threadId}>.`);
    if (inputValue != null) {
        await threadInfo.handlePrompt(user, thread, inputValue);
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