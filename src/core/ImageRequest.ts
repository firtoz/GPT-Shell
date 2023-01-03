import {Embed, EmbedBuilder, Message} from "discord.js";
import {discordClient} from "../discord/discordClient";
import {CreateImageRequestSizeEnum, ImagesResponse, OpenAIApi} from "openai";
import {v4} from "uuid";
import {logMessage} from "../utils/logMessage";
import {AxiosResponse} from "axios";
import {db} from "../database/db";

class DiscordCachedMessage {
    private readonly embeds: (Embed | EmbedBuilder)[];

    constructor(private message: Message) {
        this.embeds = message.embeds;
    }

    static cache: Record<string, DiscordCachedMessage | undefined> = {};

    static async get(channelId: string, messageId: string) {
        if (!DiscordCachedMessage.cache[messageId]) {
            const channel = await discordClient.channels.fetch(channelId);

            if (channel && channel.isTextBased()) {
                const message = await channel.messages.fetch(messageId);

                if (message) {
                    DiscordCachedMessage.cache[messageId] = new DiscordCachedMessage(message);
                }
            }
        }

        return DiscordCachedMessage.cache[messageId];
    }

    private processorRunning = false;
    private newItemAdded = false;


    async setEmbed(embedIndex: number, embed: EmbedBuilder) {
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

export class ImageRequest {
    discordMessageId: string;
    channelId: string;
    finished: boolean;
    embedIndex: number;
    lastUpdated: number;
    public result: ImagesResponse | null = null;

    constructor(public id: string, public userId: string, public description: string, public size: CreateImageRequestSizeEnum) {
        this.channelId = '';
        this.discordMessageId = '';
        this.finished = false;
        this.embedIndex = -1;
        this.lastUpdated = new Date().getTime();
    }

    static async handle(openai: OpenAIApi, descriptions: string[], userId: string, messageToReplyTo: Message): Promise<void> {
        let requests: ImageRequest[] = [];

        for (const description of descriptions) {
            const request = new ImageRequest(v4(), userId, description.slice(0, 1000), '1024x1024');

            requests.push(request);
        }

        const reply = await messageToReplyTo.reply({
            content: '',
            embeds: requests.map((request, index) => {
                request.embedIndex = index;
                return new EmbedBuilder()
                    .setTitle('Image Prompt')
                    .setDescription(`Generating:
> ${request.description}`)
            })
        });

        await Promise.all(requests.map(async item => {
            item.discordMessageId = reply.id;
            item.channelId = reply.channelId;

            // discordClient.fet
            return item.persist();
        }));

        for (let request of requests) {
            try {
                request.request(openai).catch();
            } catch (e) {
                logMessage('Cannot do image request', request, e);
            }
        }
    }

    async request(openai: OpenAIApi) {
        const response: AxiosResponse<ImagesResponse> = await openai.createImage({
            user: this.userId,
            prompt: this.description.slice(0, 1000),
            n: 1,
            size: this.size,
        }) as any;

        this.result = response.data;
        this.finished = true;

        const message = await DiscordCachedMessage.get(this.channelId, this.discordMessageId);

        if (message) {
            await message.setEmbed(this.embedIndex,
                new EmbedBuilder()
                    .setDescription(this.description)
                    .setImage(this.result!.data[0].url!)
            );
        }

        await this.persist();
    }

    private persist() {
        return db.set(`IMAGE-REQUEST-${this.id}`, this);
    }
}

export const extractDescriptions = (text: string): string[] => {
    const pattern = /\[\[(?:DRAW|IMAGE)\|(.+?)\]\]/g;
    const matches = text.match(pattern);
    if (!matches) {
        return [];
    }

    return matches.map((match) => match.replace(pattern, '$1'));
}
