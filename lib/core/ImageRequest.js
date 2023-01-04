"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractDescriptions = exports.ImageRequest = void 0;
const discord_js_1 = require("discord.js");
const discordClient_1 = require("../discord/discordClient");
const uuid_1 = require("uuid");
const logMessage_1 = require("../utils/logMessage");
const db_1 = require("../database/db");
class DiscordCachedMessage {
    message;
    embeds;
    constructor(message) {
        this.message = message;
        this.embeds = message.embeds;
    }
    static cache = {};
    static async get(channelId, messageId) {
        if (!DiscordCachedMessage.cache[messageId]) {
            const channel = await discordClient_1.discordClient.channels.fetch(channelId);
            if (channel && channel.isTextBased()) {
                const message = await channel.messages.fetch(messageId);
                if (message) {
                    DiscordCachedMessage.cache[messageId] = new DiscordCachedMessage(message);
                }
            }
        }
        return DiscordCachedMessage.cache[messageId];
    }
    processorRunning = false;
    newItemAdded = false;
    async setEmbed(embedIndex, embed) {
        this.embeds[embedIndex] = embed;
        this.newItemAdded = true;
        if (!this.processorRunning) {
            this.processorRunning = true;
            while (this.newItemAdded) {
                this.newItemAdded = false;
                await this.message.edit({
                    embeds: this.embeds,
                });
            }
            this.processorRunning = false;
        }
    }
}
class ImageRequest {
    id;
    userId;
    description;
    size;
    discordMessageId;
    channelId;
    finished;
    embedIndex;
    lastUpdated;
    result = null;
    constructor(id, userId, description, size) {
        this.id = id;
        this.userId = userId;
        this.description = description;
        this.size = size;
        this.channelId = '';
        this.discordMessageId = '';
        this.finished = false;
        this.embedIndex = -1;
        this.lastUpdated = new Date().getTime();
    }
    static async handle(openai, descriptions, userId, messageToReplyTo) {
        let requests = [];
        for (const description of descriptions) {
            const request = new ImageRequest((0, uuid_1.v4)(), userId, description.slice(0, 1000), '1024x1024');
            requests.push(request);
        }
        const reply = await messageToReplyTo.reply({
            content: '',
            embeds: requests.map((request, index) => {
                request.embedIndex = index;
                return new discord_js_1.EmbedBuilder()
                    .setTitle('Image Prompt')
                    .setDescription(`Generating:
> ${request.description}`);
            })
        });
        await Promise.all(requests.map(async (item) => {
            item.discordMessageId = reply.id;
            item.channelId = reply.channelId;
            await item.persist();
            try {
                await item.request(openai);
            }
            catch (e) {
                (0, logMessage_1.logMessage)('Cannot do image request', item, e);
            }
        }));
    }
    async request(openai) {
        const response = await openai.createImage({
            user: this.userId,
            prompt: this.description.slice(0, 1000),
            n: 1,
            size: this.size,
        });
        this.result = response.data;
        this.finished = true;
        const message = await DiscordCachedMessage.get(this.channelId, this.discordMessageId);
        if (message) {
            await message.setEmbed(this.embedIndex, new discord_js_1.EmbedBuilder()
                .setDescription(this.description)
                .setImage(this.result.data[0].url));
        }
        await this.persist();
    }
    persist() {
        return db_1.db.set(`IMAGE-REQUEST-${this.id}`, this);
    }
}
exports.ImageRequest = ImageRequest;
const extractDescriptions = (text) => {
    const pattern = /\[\[(?:DRAW|IMAGE)\|(.+?)\]\]/g;
    const matches = text.match(pattern);
    if (!matches) {
        return [];
    }
    return matches.map((match) => match.replace(pattern, '$1'));
};
exports.extractDescriptions = extractDescriptions;
//# sourceMappingURL=ImageRequest.js.map