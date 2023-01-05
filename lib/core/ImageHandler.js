"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractDescriptions = exports.ImageHandler = void 0;
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
        (0, logMessage_1.logMessage)(`Starting ${this.storage.id}`, this.storage.description);
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
        (0, logMessage_1.logMessage)(`Response ${this.storage.id}`, this.storage.result);
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
    // private reply: Message | undefined = undefined;
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
    // async request(openai: OpenAIApi) {
    //     const response: AxiosResponse<ImagesResponse> = await openai.createImage({
    //         user: this.userId,
    //         prompt: this.description.slice(0, 1000),
    //         n: 1,
    //         size: this.size,
    //     }) as any;
    //
    //     this.result = response.data;
    //     this.finished = true;
    //
    //     const message = await DiscordCachedMessage.get(this.channelId, this.discordMessageId);
    //
    //     if (message) {
    //         await message.update(this);
    //         // await message.setEmbed(
    //         //     this.embedIndex,
    //         //     new EmbedBuilder()
    //         //         .setDescription(this.description)
    //         //         .setImage(this.result!.data[0].url!),
    //         // );
    //     }
    //
    //     await this.persist();
    // }
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
const extractDescriptions = (text) => {
    const pattern = /\[\[(?:DRAW|IMAGE)\|(.+?)\]\]/g;
    const matches = text.match(pattern);
    if (!matches) {
        return [];
    }
    return matches.map((match) => match.replace(pattern, '$1'));
};
exports.extractDescriptions = extractDescriptions;
//# sourceMappingURL=ImageHandler.js.map