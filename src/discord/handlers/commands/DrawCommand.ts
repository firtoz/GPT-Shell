import {getEnv} from "../../../utils/GetEnv";
import {Command} from "../../Command";
import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    Client,
    CommandInteraction,
    EmbedBuilder, PermissionFlagsBits, PermissionResolvable
} from "discord.js";
import {
    ConfigForIdType,
    getConfigForId,
    getMessageCounter,
    MessageCountInfo,
    saveMessageCounter
} from "../../../core/config";
import {getMessageCountForUser} from "../../../core/GetMessageCountForUser";
import {discordClient, getGuildName} from "../../discordClient";
import {getOpenAIForId} from "../../../core/GetOpenAIForId";
import {OpenAIApi} from "openai";
import {logMessage} from "../../../utils/logMessage";
import {getMissingAPIKeyResponse} from "../../../utils/GetMissingAPIKeyResponse";
import {trySendingMessage} from "../../../core/TrySendingMessage";
import {ImageHandler} from "../../../core/ImageHandler";

const DRAW_COMMAND_NAME = getEnv('DRAW_COMMAND_NAME');
const adminPingId = getEnv('ADMIN_PING_ID');
const CONFIG_COMMAND_NAME = getEnv('CONFIG_COMMAND_NAME');

export const DrawCommand: Command | null = DRAW_COMMAND_NAME ? {
    name: DRAW_COMMAND_NAME,
    dmPermission: true,
    ephemeral: true,
    description: 'Tries to draw an image',
    type: ApplicationCommandType.ChatInput,
    options: [
        {
            name: 'input',
            type: ApplicationCommandOptionType.String,
            description: 'Prompt',
            required: true,
        },
    ],
    run: async (client: Client, interaction: CommandInteraction) => {
        if (!interaction.isChatInputCommand()) {
            return;
        }

        const channel = await client.channels.fetch(interaction.channelId);
        if (!channel) {
            await interaction.followUp({
                ephemeral: true,
                content: 'Cannot access channel...',
            });

            return;
        }

        try {
            if (channel.isTextBased() && !channel.isDMBased()) {
                const guildMember = await channel.guild.members.fetch(client.user!.id);

                const permissions = channel
                    .permissionsFor(guildMember.id)!;

                const hasPermissions = permissions.has(PermissionFlagsBits.ViewChannel, false)
                    && permissions.has(PermissionFlagsBits.SendMessages, false);

                if (!hasPermissions) {
                    await interaction.followUp({
                        ephemeral: true,
                        content: 'Cannot access channel...',
                    });

                    return;
                }
            }
        } catch (e) {
            await interaction.followUp({
                ephemeral: true,
                content: 'Cannot access channel...',
            });

            return;
        }

        const userId = interaction.user.id;

        let currentConfig: ConfigForIdType = await getConfigForId(userId);
        let openai: OpenAIApi | undefined = undefined;

        const isDirectMessage = !interaction.inGuild();

        if (isDirectMessage || currentConfig.useKeyInServersToo) {
            openai = await getOpenAIForId(userId);
        }

        let usingOpenAIForServer = false;

        if (!isDirectMessage && !openai) {
            openai = await getOpenAIForId(interaction.guildId);
            usingOpenAIForServer = true;
            currentConfig = await getConfigForId(interaction.guildId);
        }

        if (!openai) {
            logMessage(`No api key for [${(isDirectMessage ? interaction.user.username : await getGuildName(interaction.guildId))}].`);

            const response = await getMissingAPIKeyResponse(isDirectMessage);

            const MAIN_SERVER_INVITE = getEnv('MAIN_SERVER_INVITE');
            if (MAIN_SERVER_INVITE) {
                response.content += '\n' + MAIN_SERVER_INVITE;
            }

            await interaction.followUp({
                ...response,
                ephemeral: true,
            });

            return;
        }

        if (!isDirectMessage) {
            const guildId = interaction.guildId;

            const guild = await discordClient.guilds.fetch(guildId);
            const member = await guild.members.fetch(userId);

            const userHasExceptionRole = currentConfig
                .exceptionRoleIds
                .some(exceptionRoleId => member.roles.cache.has(exceptionRoleId));

            const messageCounter = await getMessageCounter(guildId);

            const userShouldBeRestricted = usingOpenAIForServer
                && currentConfig.maxImagePerUser != -1
                && userId !== adminPingId
                && !userHasExceptionRole
            ;

            if (userShouldBeRestricted) {
                const messageCountForUser: MessageCountInfo = getMessageCountForUser(messageCounter, userId);

                if (messageCountForUser.imageLimitCount >= currentConfig.maxImagePerUser) {
                    await interaction.followUp({
                        ephemeral: true,
                        content: '',
                        embeds: [
                            new EmbedBuilder()
                                .setTitle('Image Limit')
                                .setDescription(`
Detected [[DRAW]] commands but image limit was reached.
                                    
The bot has generated ${messageCountForUser.imageLimitCount} images out of the maximum allowed ${currentConfig.maxImagePerUser}.

The bot will not be able to generate any more images for you in this server until the server Admin allows for more.

This limit resets every month.
                             
If you'd like to use your own API key to generate images, you can provide your API key by using \`/${CONFIG_COMMAND_NAME}\` in a DM to me.

You can contact a server Admin if you have any questions.

Thank you for your understanding.`),
                        ]
                    });

                    return;
                }

                messageCountForUser.imageCount += 1;
                messageCountForUser.imageLimitCount += 1;
                messageCounter[userId] = messageCountForUser;
                await saveMessageCounter(guildId, messageCounter);
            }
        }

        const inputOption = interaction.options.get('input');
        const inputValue = inputOption!.value as string;

        await interaction.followUp({
            ephemeral: false,
            content: `Prompt accepted.`,
        });

        const reply = await interaction.followUp({
            ephemeral: false,
            embeds: [
                new EmbedBuilder()
                    .setAuthor({
                        name: interaction.user.username,
                        iconURL: interaction.user.avatarURL() ?? undefined,
                    })
                    .setDescription(`/${DRAW_COMMAND_NAME} ${inputValue}`),
            ],
        });

        await interaction.deleteReply();

        await ImageHandler.handle(openai, [inputValue], userId, reply, true);
    }
} : null;
