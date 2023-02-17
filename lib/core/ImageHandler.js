"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractImageDescriptions = exports.ImageHandler = void 0;
const discord_js_1 = require("discord.js");
const uuid_1 = require("uuid");
const logMessage_1 = require("../utils/logMessage");
const axios_1 = __importDefault(require("axios"));
const db_1 = require("../database/db");
class ImageHandlerRequest {
    parent;
    storage;
    constructor(parent, storage) {
        this.parent = parent;
        this.storage = storage;
    }
    async start(message, isCommand = false) {
        let replyPromise;
        if (isCommand) {
            replyPromise = message.edit({
                embeds: [
                    message.embeds[0],
                    new discord_js_1.EmbedBuilder()
                        .setTitle('Image Prompt')
                        .setDescription(`Generating:
> ${this.storage.description}`),
                ],
            }).then(reply => {
                this.storage.channelId = reply.channelId;
                this.storage.discordMessageId = reply.id;
                return reply;
            });
        }
        else {
            replyPromise = message.reply({
                content: '',
                embeds: [
                    new discord_js_1.EmbedBuilder()
                        .setTitle('Image Prompt')
                        .setDescription(`Generating:
> ${this.storage.description}`),
                ],
            }).then(reply => {
                this.storage.channelId = reply.channelId;
                this.storage.discordMessageId = reply.id;
                return reply;
            });
        }
        const responsePromise = this.parent.openai.createImage({
            user: this.parent.storage.userId,
            prompt: this.storage.description,
            n: 1,
            size: this.parent.storage.size,
        });
        const response = await responsePromise;
        this.storage.result = response.data;
        this.storage.finished = true;
        this.storage.lastUpdated = new Date().getTime();
        const axiosResponse = await (0, axios_1.default)({
            method: 'get',
            url: response.data.data[0].url,
            responseType: 'stream'
        });
        const attachment = new discord_js_1.AttachmentBuilder(axiosResponse.data, {
            name: `${this.storage.id}.png`,
            description: this.storage.description,
        });
        const reply = await replyPromise;
        const finalEmbed = new discord_js_1.EmbedBuilder()
            .setDescription(this.storage.description)
            .setImage(`attachment://${this.storage.id}.png`);
        await reply.edit({
            files: [attachment],
            embeds: isCommand ? [
                message.embeds[0],
                finalEmbed,
            ] : [
                finalEmbed,
            ],
        });
    }
}
class ImageHandler {
    openai;
    storage;
    requests;
    constructor(openai, storage) {
        this.openai = openai;
        this.storage = storage;
        this.requests = storage.subItems.map(item => new ImageHandlerRequest(this, item));
    }
    static async handle(openai, descriptions, userId, messageToReplyTo, isCommand = false) {
        const timeNow = new Date().getTime();
        const request = new ImageHandler(openai, {
            id: (0, uuid_1.v4)(),
            userId,
            size: '1024x1024',
            subItems: descriptions.map((description) => {
                return {
                    id: (0, uuid_1.v4)(),
                    description,
                    finished: false,
                    lastUpdated: timeNow,
                    result: undefined,
                    channelId: '',
                    discordMessageId: '',
                };
            }),
            lastUpdated: timeNow,
        });
        await request.handle(messageToReplyTo, isCommand);
    }
    persist() {
        return db_1.db.set(`IMAGE-HANDLER-${this.storage.id}`, this.storage);
    }
    async handle(messageToReplyTo, isCommand = false) {
        await this.persist();
        await Promise.all(this.requests.map(async (request) => {
            try {
                await request.start(messageToReplyTo, isCommand);
            }
            catch (e) {
                (0, logMessage_1.logMessage)('Cannot do image request', request, e);
            }
        }));
    }
}
exports.ImageHandler = ImageHandler;
const extractImageDescriptions = (text) => {
    const pattern = /\[\[\s*(?:DRAW|IMAGE)\s*\|(.+?)\]\]/gi;
    const matches = text.match(pattern);
    if (!matches) {
        return [];
    }
    return matches.map((match) => match.replace(pattern, '$1').trim());
};
exports.extractImageDescriptions = extractImageDescriptions;
//# sourceMappingURL=ImageHandler.js.map