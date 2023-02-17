import { Message } from "discord.js";
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
export declare class WolframHandler {
    storage: WolframHandlerStorage;
    private subItems;
    constructor(storage: WolframHandlerStorage);
    static handle(descriptions: string[], userId: string, messageToReplyTo: Message, isCommand?: boolean): Promise<void>;
}
export declare const extractWolframDescriptions: (text: string) => string[];
export {};
