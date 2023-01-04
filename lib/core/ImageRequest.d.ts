import { Message } from "discord.js";
import { CreateImageRequestSizeEnum, ImagesResponse, OpenAIApi } from "openai";
export declare class ImageRequest {
    id: string;
    userId: string;
    description: string;
    size: CreateImageRequestSizeEnum;
    discordMessageId: string;
    channelId: string;
    finished: boolean;
    embedIndex: number;
    lastUpdated: number;
    result: ImagesResponse | null;
    constructor(id: string, userId: string, description: string, size: CreateImageRequestSizeEnum);
    static handle(openai: OpenAIApi, descriptions: string[], userId: string, messageToReplyTo: Message): Promise<void>;
    request(openai: OpenAIApi): Promise<void>;
    private persist;
}
export declare const extractDescriptions: (text: string) => string[];
