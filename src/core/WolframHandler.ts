import {AttachmentBuilder, EmbedBuilder, Message, MessageReaction} from "discord.js";
import axios, {AxiosError, AxiosResponse} from "axios";
import {v4} from "uuid";
import {logMessage} from "../utils/logMessage";
import {discordClient} from "../discord/discordClient";
import {getEnv} from "../utils/GetEnv";

const WOLFRAM_APP_ID = getEnv('WOLFRAM_APP_ID')!;

async function getSplitImageData(url: string, maxHeight: number): Promise<Buffer[]> {
    const axiosResponse: AxiosResponse<ArrayBuffer> = await axios({
        method: 'get',
        url,
        responseType: 'arraybuffer'
    });

    try {
        const {createCanvas, loadImage: canvasLoadImage} = await import('canvas');

        const image = await canvasLoadImage(Buffer.from(axiosResponse.data));
        const imageHeight = image.height;
        const canvas = createCanvas(image.width, imageHeight);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);

        const buffers: Buffer[] = [];

        let currStart = 0;
        let finished = false;

        while (!finished) {
            let currEnd = currStart + maxHeight;
            if (currEnd >= imageHeight) {
                currEnd = imageHeight;
                finished = true;
            }

            const newCanvas = createCanvas(image.width, currEnd - currStart);
            newCanvas.getContext('2d').putImageData(ctx.getImageData(0, currStart, image.width, currEnd - currStart), 0, 0);

            buffers.push(newCanvas.toBuffer('image/png'));

            currStart = currEnd + 1;
        }

        return buffers;
    } catch (e) {
        return [Buffer.from(axiosResponse.data)];
    }
}

type WolframHandlerRequestStorage = {
    id: string;
    finished: boolean;
    description: string;
    lastUpdated: number;
    result: string | undefined;
    channelId: string;
    discordMessageId: string;
};
type WolframHandlerStorage = {
    id: string;
    subItems: WolframHandlerRequestStorage[];
};

export class WolframHandler {
    private subItems: WolframHandlerRequestStorage[];

    constructor(public storage: WolframHandlerStorage) {
        this.subItems = storage.subItems;
    }

    static async handle(
        descriptions: string[],
        userId: string,
        messageToReplyTo: Message,
        isCommand: boolean = false,
    ): Promise<void> {
        let reaction: MessageReaction | null = null;
        try {
            reaction = await messageToReplyTo.react('⏳');
        } catch (e) {
            // ignore
        }

        const bufferList: ({
            success: true,
            result: Buffer[],
        } | {
            success: false,
            error: AxiosError,
        })[] = await Promise.all(descriptions.map(async description => {
            try {
                const url = `https://api.wolframalpha.com/v1/simple?i=${encodeURIComponent(description)}&appid=${WOLFRAM_APP_ID}&width=1024&fontsize=38&units=metric&layout=labelbar`;
                // http://api.wolframalpha.com/v2/query?appid=DEMO&input=population%20of%20france&output=json

                return {
                    success: true,
                    result: await getSplitImageData(url, 600),
                };
            } catch (e) {
                return {
                    success: false,
                    error: e as any as AxiosError<ArrayBuffer>,
                }
            }
        }));

        for (let descIndex = 0; descIndex < descriptions.length; descIndex++) {
            let description = descriptions[descIndex];
            const id = v4();

            try {
                const splitResponse = bufferList[descIndex];
                if (!splitResponse.success) {
                    throw splitResponse.error;
                }

                const buffers = splitResponse.result;

                const countPerImage = 5;

                for (let i = 0; i < buffers.length; i += countPerImage) {
                    const bufferSlice = buffers.slice(i, i + countPerImage);

                    const files = bufferSlice.map((buffer, j) => new AttachmentBuilder(buffer, {
                        name: `${id}-${i + j}.png`,
                        description: `${description}-${i + j}`,
                    }));

                    if (i === 0) {
                        await messageToReplyTo.reply({
                            content: description,
                            files,
                        });
                    } else {
                        await messageToReplyTo.channel.send({
                            files,
                        })
                    }
                }
            } catch (e) {
                const axiosError: AxiosError<ArrayBuffer> = e as any;

                logMessage(axiosError);

                const data = axiosError.response?.data;
                const message = data ? new TextDecoder().decode(data) : 'Unknown error';

                const embeds = [
                    new EmbedBuilder()
                        .setTitle('Wolfram Request')
                        .setDescription(`Failed to get image for description ${description}: ${message}`)
                        .setColor(0xff0000)
                ];

                try {
                    await messageToReplyTo.reply({
                        embeds,
                    });
                } catch (e) {
                    logMessage('failed to send error', e, {embeds});
                }
            }
        }


        try {
            if (reaction) {
                await reaction.users.remove(discordClient.user!.id);
            }
        } catch (e) {
            // ignore
        }
    }
}

export const extractWolframDescriptions = (text: string): string[] => {
    const pattern = /\[\[\s*WOLFRAM\s*\|(.+?)\]\]/gi;
    const matches = text.match(pattern);
    if (!matches) {
        return [];
    }

    return matches.map((match) => match.replace(pattern, '$1').trim());
}
