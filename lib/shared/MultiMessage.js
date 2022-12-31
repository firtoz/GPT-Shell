"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MultiMessage = void 0;
const discord_js_1 = require("discord.js");
const DivideTextToSections_1 = require("./DivideTextToSections");
const logMessage_1 = require("../utils/logMessage");
// The maximum length of a message
const MAX_MESSAGE_LENGTH = 1900;
// A temporary embed that is used to indicate that there are more messages
const tempEmbed = new discord_js_1.EmbedBuilder()
    .setColor(0xFFFF00)
    .setTitle('...');
const errorEmbed = new discord_js_1.EmbedBuilder()
    .setColor(0xFF0000)
    .setTitle('Error... You can ask GPTChat to repeat itself if it cut off too early.');
class MultiMessage {
    channel;
    messageToReplyTo;
    // A list of messages that make up this multi-message
    messageList;
    isLogMessage = false;
    // The thread that the messages will be sent to
    constructor(channel, firstMessage, messageToReplyTo) {
        this.channel = channel;
        this.messageToReplyTo = messageToReplyTo;
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
    async update(message, finished, error = false) {
        // If the message is finished, don't include the "more messages" embed
        let embeds;
        if (error) {
            embeds = [errorEmbed];
        }
        else if (finished) {
            embeds = [];
        }
        else {
            embeds = [tempEmbed];
        }
        // Divide the message into sections that are no longer than MAX_MESSAGE_LENGTH
        const sections = (0, DivideTextToSections_1.divideTextToSections)(message, MAX_MESSAGE_LENGTH);
        try {
            // Iterate over the sections and update the corresponding messages
            await this.updateMessages(sections, embeds);
        }
        catch (e) {
            if (!this.isLogMessage) {
                (0, logMessage_1.logMessage)(`Cannot send a message: [${this.channel.isDMBased() ? 'DM' : this.channel.guild?.name ?? this.channel.guildId}] <#${this.channel.id}>`);
            }
            else {
                console.error(`Cannot send a message: [${this.channel.isDMBased() ? 'DM' : this.channel.guild?.name ?? this.channel.guildId}] <#${this.channel.id}>`);
            }
        }
    }
    async updateMessages(sections, embeds) {
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
                    await messageListElement.message.edit({ content: section, embeds: [] });
                }
                else {
                    // Update the message with the new section and the "more messages" embed
                    await messageListElement.message.edit({ content: section, embeds });
                    messageListElement.cached = section;
                }
            }
            else {
                // If the message doesn't already exist, create it
                let newMessage;
                if (this.messageToReplyTo != null && this.messageList.length === 0) {
                    newMessage = await this.messageToReplyTo.reply({ content: section, embeds });
                }
                else {
                    newMessage = await this.channel.send({ content: section, embeds });
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
exports.MultiMessage = MultiMessage;
//# sourceMappingURL=MultiMessage.js.map