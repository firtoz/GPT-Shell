import {Client, Events, Message} from "discord.js";
import {handleThread} from "./handleThread";
import {handleDirectMessage} from "./handleDirectMessage";
import {BaseConversation} from "../../../../core/BaseConversation";
import {ConversationFactory} from "../../../../core/ConversationFactory";


export function StartListeningToMessages(client: Client<boolean>) {
    const handleNewMessage = async (message: Message) => {
        const currentBotId = client.user!.id;

        if (message.author.id === currentBotId) {
            return;
        }

        if (!message.channel) {
            await client.channels.fetch(message.channelId);
        }

        const channel = message.channel;
        if (!channel) {
            console.log('well, no channel');

            return;
        }

        if (channel.isDMBased()) {
            if(message.author.dmChannel === channel) {
                await handleDirectMessage(message.channelId, message, currentBotId, channel);
            }
            return;
        }

        if (!message.inGuild()) {
            // TODO handle DMs
            return;
        }

        const channelId = channel.id;

        if (channelId == null) {
            return;
        }

        if (!channel.isTextBased()) {
            return;
        }

        if (!channel.isThread()) {
            await ConversationFactory.handleChannelMessage(channelId, message, currentBotId, channel);

            return;
        }

        await handleThread(channelId, message, channel);
    };

    console.log('ready to listen to messages...');

    client.on(Events.MessageCreate, handleNewMessage);
}
