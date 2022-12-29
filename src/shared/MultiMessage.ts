import {EmbedBuilder, Message, TextBasedChannel} from "discord.js";
import {divideTextToSections} from "./DivideTextToSections";
import {logMessage} from "../utils/logMessage";

// The maximum length of a message
const MAX_MESSAGE_LENGTH = 1900;

// A temporary embed that is used to indicate that there are more messages
const tempEmbed = new EmbedBuilder()
    .setColor(0xFFFF00)
    .setTitle('...');

const errorEmbed = new EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle('Error... You can ask GPTChat to repeat itself if it cut off too early.');

export class MultiMessage {
    // A list of messages that make up this multi-message
    public readonly messageList: {
        finished: boolean,
        cached: string,
        message: Message<boolean>,
    }[];

    public isLogMessage = false;

    // The thread that the messages will be sent to
    constructor(
        private channel: TextBasedChannel,
        firstMessage?: Message<boolean>,
        private messageToReplyTo?: Message<boolean>,
    ) {
        this.messageList = [];

        if (firstMessage != null) {
            this.messageList.push({
                cached: '...',
                finished: false,
                message: firstMessage,
            });
        }
    }

    // Update the multi-message with a new message
    async update(message: string, finished: boolean, error: boolean = false) {
        // If the message is finished, don't include the "more messages" embed
        let embeds: EmbedBuilder[];

        if (error) {
            embeds = [errorEmbed];
        } else if (finished) {
            embeds = [];
        } else {
            embeds = [tempEmbed];
        }

        // Divide the message into sections that are no longer than MAX_MESSAGE_LENGTH
        const sections = divideTextToSections(message, MAX_MESSAGE_LENGTH);

        try {
            // Iterate over the sections and update the corresponding messages
            await this.updateMessages(sections, embeds);
        } catch (e) {
            if(!this.isLogMessage) {
                logMessage(`Cannot send a message: [${this.channel.isDMBased() ? 'DM' : this.channel.guild?.name ?? this.channel.guildId}] <#${this.channel.id}>`)
            } else {
                console.error(`Cannot send a message: [${this.channel.isDMBased() ? 'DM' : this.channel.guild?.name ?? this.channel.guildId}] <#${this.channel.id}>`)
            }
        }
    }

    private async updateMessages(sections: string[], embeds: EmbedBuilder[]) {
        for (let i = 0; i < sections.length; ++i) {
            const section = sections[i];

            if (this.messageList.length > i) {
                // If the message already exists, update it
                const messageListElement = this.messageList[i];
                if (messageListElement.cached === section) {
                    if (messageListElement.finished) {
                        continue;
                    }

                    // Update the message with the new section and no embeds
                    await messageListElement.message.edit({content: section, embeds: []});
                } else {
                    // Update the message with the new section and the "more messages" embed
                    await messageListElement.message.edit({content: section, embeds});
                    messageListElement.cached = section;
                }
            } else {
                // If the message doesn't already exist, create it
                let newMessage: Message;

                if (this.messageToReplyTo != null && this.messageList.length === 0) {
                    newMessage = await this.messageToReplyTo.reply({content: section, embeds});
                } else {
                    newMessage = await this.channel.send({content: section, embeds});
                }

                this.messageList.push({
                    cached: section,
                    finished: false,
                    message: newMessage,
                });
            }
        }
    }
}
