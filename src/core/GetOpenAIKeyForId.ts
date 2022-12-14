import {Configuration, OpenAIApi} from "openai";
import {db} from "../database/db";

export const OpenAICache: Record<string, OpenAIApi | undefined> = {};

export async function getOpenAIKeyForId(id: string) {
    if (OpenAICache[id] === undefined) {
        const apiKey = await db.get<string>(`CONFIG-API-KEY-${id}`);
        if (apiKey !== null) {
            OpenAICache[id] = new OpenAIApi(new Configuration({
                apiKey: apiKey,
            }));
        }
    }

    return OpenAICache[id];
}
