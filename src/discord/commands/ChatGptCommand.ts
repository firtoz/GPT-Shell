import {
    AnyThreadChannel,
    ApplicationCommandOptionData,
    ApplicationCommandOptionType,
    ApplicationCommandType,
    Client,
    CommandInteraction,
    EmbedType,
    ThreadAutoArchiveDuration
} from "discord.js";
import {Command} from "../Command";
import {getEnv} from "../../utils/GetEnv";
import {ChatGPTConversation} from "../../core/ChatGPTConversation";
import {logMessage} from "../../utils/logMessage";
import {discordClient} from "../discordClient";
import {getMissingAPIKeyResponse} from "../../utils/GetMissingAPIKeyResponse";
import {getDateString} from "../../utils/GetDateString";
import {ModelName} from "../../core/ModelInfo";
import {getOpenAIKeyForId} from "../../core/GetOpenAIKeyForId";
import {trySendingMessage} from "../../core/TrySendingMessage";

const COMMAND_NAME = getEnv('COMMAND_NAME');

if (COMMAND_NAME == null) {
    throw new Error('No command name?');
}

const options: ApplicationCommandOptionData[] = [
    {
        name: 'input',
        type: ApplicationCommandOptionType.String,
        description: 'Text input.',
        required: false,
    }
];

async function handleChat(interaction: CommandInteraction, client: Client<boolean>, model: ModelName) {
    if (!interaction.inGuild()) {
        return;
    }

    if (!await getOpenAIKeyForId(interaction.guildId)) {
        await interaction.followUp(await getMissingAPIKeyResponse(false));

        const MAIN_SERVER_INVITE = getEnv('MAIN_SERVER_INVITE');
        if(MAIN_SERVER_INVITE) {
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

    if (!message.channel) {
        await client.channels.fetch(message.channelId);
    }

    const inputValue = inputOption?.value as string | undefined;

    const threadName = `${user.username} - ${value ?? getDateString(new Date())}`
        .substring(0, 80);

    let thread: AnyThreadChannel;

    try {
        thread = await message.startThread({
            name: threadName,
            reason: 'ChatGPT',
            autoArchiveDuration: ThreadAutoArchiveDuration.OneHour,
        });
    } catch (e) {
        try {
            await interaction.followUp('Could not create thread... Please ask an admin for permissions!');
        } catch (e) {
            logMessage(`Cannot even follow up in <#${message.channelId}> of ${message.guild?.name}.`);
        }
        logMessage(`Cannot create thread in <#${message.channelId}> of ${message.guild?.name}.`);
        return;
    }

    const threadInfo = new ChatGPTConversation(thread.id, userId, interaction.guildId, discordClient.user!.username, model);

    await threadInfo.persist();

    logMessage(`New thread by <@${threadInfo.creatorId}> in [${interaction.guild?.name ?? 'Unknown Server'}]: <#${threadInfo.threadId}>.`);

    if (inputValue != null) {
        await threadInfo.handlePrompt(
            user,
            thread,
            inputValue
        );
    } else {
        await trySendingMessage(thread, {content: `[[<@${userId}>, ${client.user!.username} will respond to your messages in this thread.]]`}, undefined);
    }
}

export const ChatGptCommand: Command = {
    name: COMMAND_NAME,
    dmPermission: false,
    description: "Starts a chat",
    type: ApplicationCommandType.ChatInput,
    options,
    run: async (client: Client, interaction: CommandInteraction) => {
        const model = 'text-davinci-003';
        await handleChat(interaction, client, model);
    }
};

