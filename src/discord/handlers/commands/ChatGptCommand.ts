import {
    AnyThreadChannel,
    ApplicationCommandOptionData,
    ApplicationCommandOptionType,
    ApplicationCommandType,
    ChannelType,
    Client,
    CommandInteraction,
    EmbedBuilder,
    EmbedType,
    Message,
    TextChannel,
    ThreadAutoArchiveDuration
} from "discord.js";
import {Command} from "../../Command";
import {getEnv} from "../../../utils/GetEnv";
import {logMessage} from "../../../utils/logMessage";
import {discordClient, getGuildName} from "../../discordClient";
import {getMissingAPIKeyResponse} from "../../../utils/GetMissingAPIKeyResponse";
import {getDateString} from "../../../utils/GetDateString";
import {ModelName} from "../../../core/ModelInfo";
import {getOpenAIForId} from "../../../core/GetOpenAIForId";
import {trySendingMessage} from "../../../core/TrySendingMessage";
import {ConversationFactory} from "../../../core/ConversationFactory";
import {retrieveConversation} from "../../../core/RetrieveConversation";
import {ChatGPTConversation} from "../../../core/ChatGPTConversation";

const COMMAND_NAME = getEnv('COMMAND_NAME');
const PRIVATE_COMMAND_NAME = getEnv('PRIVATE_COMMAND_NAME');

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

async function handleChat(interaction: CommandInteraction, client: Client<boolean>, model: ModelName, isPrivate = false) {
    if (!interaction.inGuild()) {
        return;
    }

    let openAI = await getOpenAIForId(interaction.guildId);
    if (!openAI) {
        if (!openAI) {
            // fallback to user's key...
            openAI = await getOpenAIForId(interaction.user.id);
        }
        if (!openAI) {
            logMessage(`Could not find API key for server ${await getGuildName(interaction.guildId)}[${interaction.guildId}}] or user [[${interaction.user.username}|${interaction.user.id}]]`);

            await interaction.followUp(await getMissingAPIKeyResponse(false));

            const MAIN_SERVER_INVITE = getEnv('MAIN_SERVER_INVITE');
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
        await discordClient.channels.fetch(interaction.channelId);
    }

    const inputValue = inputOption?.value as string | undefined;


    let thread: AnyThreadChannel;

    let message: Message;

    const channel = interaction.channel;

    const embeds = [
        new EmbedBuilder()
            .setAuthor({
                name: user.username,
                iconURL: user.avatarURL() ?? undefined,
            })
            .setDescription(firstMessage),
    ];

    let referenceThreadHere: Message | null = null;

    if (isPrivate) {
        message = await interaction.followUp({
            ephemeral: true,
            embeds: [
                new EmbedBuilder()
                    .setDescription('Creating new private thread...'),
            ]
        });
    } else if (channel?.isThread()) {
        referenceThreadHere = await interaction.followUp({
            options: {
                username: user.username,
                avatarURL: user.avatarURL() ?? '',
            },
            embeds: [
                new EmbedBuilder()
                    .setDescription('Creating new thread in channel...'),
            ]
        });

        const starterMessage = await channel.fetchStarterMessage();

        if (starterMessage != null) {
            message = await starterMessage.reply({
                content: `Thread spun off from <#${channel.id}>: `,
                embeds
            });
        } else {
            message = await channel.send({
                content: `Thread spun off from <#${channel.id}>: `,
                embeds,
            });
        }
    } else {
        message = await interaction.followUp({
            embeds,
        })
    }

    try {
        const threadName = `${user.username} - ${value ?? getDateString(new Date())}`
            .substring(0, 80);

        if (isPrivate) {
            const messageChannel = await discordClient.channels.fetch(message.channelId);
            if (messageChannel && messageChannel instanceof TextChannel) {
                const privateThread = await messageChannel.threads.create({
                    name: threadName,
                    reason: 'ChatGPT',
                    autoArchiveDuration: ThreadAutoArchiveDuration.OneHour,
                    type: ChannelType.PrivateThread,
                });

                await privateThread.members.add(userId);

                await interaction.followUp({
                    ephemeral: true,
                    embeds: [new EmbedBuilder()
                        .setTitle('Created Private Thread')
                        .setDescription(`Link: <#${privateThread.id}>.`)
                    ]
                });

                thread = privateThread as AnyThreadChannel;
            } else {
                return;
            }
        } else {
            thread = await message.startThread({
                name: threadName,
                reason: 'ChatGPT',
                autoArchiveDuration: ThreadAutoArchiveDuration.OneHour,
            });
        }

        if (referenceThreadHere != null) {
            await referenceThreadHere.edit({
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`Created spinoff: <#${thread.id}>.`)
                ]
            })
        }
    } catch (e) {
        try {
            await interaction.followUp('Could not create thread... Please ask an admin for permissions!');
        } catch (e) {
            logMessage(`Cannot even follow up in <#${message.channelId}> of ${message.guild?.name}.`);
        }
        logMessage(`Cannot create thread in <#${message.channelId}> of ${message.guild?.name}.`, e);
        return;
    }


    const conversation = ConversationFactory.create(thread.id, userId, interaction.guildId, discordClient.user!.username, model);

    const existingConvo = await retrieveConversation(interaction.channelId) as ChatGPTConversation | null;

    if (existingConvo && existingConvo.version == ChatGPTConversation.latestVersion) {
        conversation.username = existingConvo.username;
        conversation.customPrompt = existingConvo.customPrompt;
        conversation.temperature = existingConvo.temperature;
    }

    await conversation.persist();

    logMessage(`New thread by <@${user.id}> in ${await conversation.getLinkableId()}.`);

    if (inputValue != null) {
        await conversation.handlePrompt(
            user,
            thread,
            inputValue
        );
    }

    await trySendingMessage(thread, {content: `[[<@${userId}>, ${conversation.username} will respond to your messages in this thread.]]`}, undefined);
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

export const PrivateChatGptCommand: Command | null = PRIVATE_COMMAND_NAME ? {
    name: PRIVATE_COMMAND_NAME,
    dmPermission: false,
    ephemeral: true,
    description: "Starts a private chat",
    type: ApplicationCommandType.ChatInput,
    options,
    run: async (client: Client, interaction: CommandInteraction) => {
        const model = 'text-davinci-003';
        await handleChat(interaction, client, model, true);
    }
} : null;

