import {AttachmentBuilder, EmbedBuilder, Message} from "discord.js";
import {CreateImageRequestSizeEnum, ImagesResponse, OpenAIApi} from "openai";
import {v4} from "uuid";
import {logMessage} from "../utils/logMessage";
import axios, {AxiosResponse} from "axios";
import {db} from "../database/db";
import {Stream} from "mongodb";
import * as repl from "repl";

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
        logMessage(`Starting ${this.storage.id}`, this.storage.description);

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

        logMessage(`Response ${this.storage.id}`, this.storage.result)

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

    // private reply: Message | undefined = undefined;

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


    // private processorRunning = false;
    // private updateSignalled = false;

//     async signalUpdate() {
//         this.updateSignalled = true;
//
//         if (!this.processorRunning) {
//             this.processorRunning = true;
//             while (this.updateSignalled) {
//                 this.updateSignalled = false;
//
//                 try {
//                     const reply = this.reply;
//                     if (reply) {
//                         const files = this.requests
//                             .filter(item => item.attachment)
//                             .map(item => {
//                                 return item.attachment!;
//                             })
//
//                         const embeds = this.requests.map(item => {
//                             if (item.attachment) {
//                                 return new EmbedBuilder()
//                                     .setTitle('Image Prompt Finished')
//                                     .setDescription(item.storage.description)
//                                     .setImage(`attachment://${item.storage.id}.png`)
//                             } else {
//                                 return new EmbedBuilder()
//                                     .setTitle('Image Prompt')
//                                     .setDescription(`Generating...
// > ${item.storage.description}`)
//                             }
//                         });
//
//                         await reply.edit({
//                             content: '',
//                             embeds,
//                             files,
//                         });
//
//                         await new Promise(resolve => setTimeout(resolve, 500));
//                     }
//
//                     await this.persist();
//                 } catch (e) {
//                     logMessage(`Cannot update image handler ${this.storage.id}.`, e);
//                 }
//             }
//             this.processorRunning = false;
//         }
//     }
}

export const extractDescriptions = (text: string): string[] => {
    const pattern = /\[\[(?:DRAW|IMAGE)\|(.+?)\]\]/g;
    const matches = text.match(pattern);
    if (!matches) {
        return [];
    }

    return matches.map((match) => match.replace(pattern, '$1'));
}
