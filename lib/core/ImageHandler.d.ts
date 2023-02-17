import { Message } from "discord.js";
import { CreateImageRequestSizeEnum, ImagesResponse, OpenAIApi } from "openai";
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
export declare class ImageHandler {
    openai: OpenAIApi;
    storage: ImageHandlerStorage;
    private requests;
    constructor(openai: OpenAIApi, storage: ImageHandlerStorage);
    static handle(openai: OpenAIApi, descriptions: string[], userId: string, messageToReplyTo: Message, isCommand?: boolean): Promise<void>;
    private persist;
    private handle;
}
export declare const extractImageDescriptions: (text: string) => string[];
export {};
