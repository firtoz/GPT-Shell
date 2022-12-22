import {Configuration, OpenAIApi} from "openai";
import {db} from "../database/db";
import {getEnv} from "../utils/GetEnv";

export const OpenAICache: Record<string, OpenAIApi | undefined> = {};

const OPENAI_API_KEY = getEnv('OPENAI_API_KEY');
const MAIN_SERVER_ID = getEnv('MAIN_SERVER_ID');

if (!OPENAI_API_KEY) {
    throw new Error('Need OPENAI_API_KEY env variable.');
}
if (!MAIN_SERVER_ID) {
    throw new Error('Need MAIN_SERVER_ID env variable.');
}

OpenAICache[MAIN_SERVER_ID] = new OpenAIApi(new Configuration({
    apiKey: OPENAI_API_KEY,
}));

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
