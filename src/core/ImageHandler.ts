import {AttachmentBuilder, EmbedBuilder, Message} from "discord.js";
import {CreateImageRequestSizeEnum, ImagesResponse, OpenAIApi} from "openai";
import {v4} from "uuid";
import {logMessage} from "../utils/logMessage";
import axios, {AxiosResponse} from "axios";
import {db} from "../database/db";
import {Stream} from "mongodb";

type ImageHandlerRequestStorage = {
    id: string;
    finished: boolean;
    description: string;
    lastUpdated: number;
    result: ImagesResponse | undefined;
    channelId: string;
    discordMessageId: string;
};

type ImageHandlerStorage = {
    id: string;
    userId: string;
    lastUpdated: number;
    size: CreateImageRequestSizeEnum;
    subItems: ImageHandlerRequestStorage[];
};


class ImageHandlerRequest {
    constructor(
        public parent: ImageHandler,
        public storage: ImageHandlerRequestStorage,
    ) {
    }

    async start(message: Message, isCommand: boolean = false) {
        let replyPromise: Promise<Message>;

        if (isCommand) {
            replyPromise = message.edit({
                embeds: [
                    message.embeds[0],
                    new EmbedBuilder()
                        .setTitle('Image Prompt')
                        .setDescription(`Generating:
> ${this.storage.description}`),
                ],
            }).then(reply => {
                this.storage.channelId = reply.channelId;
                this.storage.discordMessageId = reply.id;

                return reply;
            });
        } else {
            replyPromise = message.reply({
                content: '',
                embeds: [
                    new EmbedBuilder()
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

        const response: AxiosResponse<ImagesResponse> = await responsePromise as any;

        this.storage.result = response.data;

        this.storage.finished = true;
        this.storage.lastUpdated = new Date().getTime();

        const axiosResponse: AxiosResponse<Stream> = await axios({
            method: 'get',
            url: response.data.data[0].url,
            responseType: 'stream'
        });

        const attachment = new AttachmentBuilder(axiosResponse.data, {
            name: `${this.storage.id}.png`,
            description: this.storage.description,
        });

        const reply = await replyPromise;

        const finalEmbed = new EmbedBuilder()
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

export class ImageHandler {
    private requests: ImageHandlerRequest[];

    constructor(public openai: OpenAIApi, public storage: ImageHandlerStorage) {
        this.requests = storage.subItems.map(item => new ImageHandlerRequest(this, item));
    }

    static async handle(openai: OpenAIApi, descriptions: string[], userId: string, messageToReplyTo: Message, isCommand: boolean = false): Promise<void> {
        const timeNow = new Date().getTime();

        const request = new ImageHandler(openai, {
            id: v4(),
            userId,
            size: '1024x1024',
            subItems: descriptions.map((description): ImageHandlerRequestStorage => {
                return {
                    id: v4(),
                    description,
                    finished: false,
                    lastUpdated: timeNow,
                    result: undefined,
                    channelId: '',
                    discordMessageId: '',
                }
            }),
            lastUpdated: timeNow,
        });

        await request.handle(messageToReplyTo, isCommand);
    }

    private persist() {
        return db.set(`IMAGE-HANDLER-${this.storage.id}`, this.storage);
    }

    private async handle(messageToReplyTo: Message, isCommand: boolean = false) {
        await this.persist();

        await Promise.all(this.requests.map(async request => {
            try {
                await request.start(messageToReplyTo, isCommand);
            } catch (e) {
                logMessage('Cannot do image request', request, e);
            }
        }));
    }
}

export const extractImageDescriptions = (text: string): string[] => {
    const pattern = /\[\[\s*(?:DRAW|IMAGE)\s*\|(.+?)\]\]/gi;
    const matches = text.match(pattern);
    if (!matches) {
        return [];
    }

    return matches.map((match) => match.replace(pattern, '$1').trim());
}
