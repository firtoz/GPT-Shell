import {Configuration, OpenAIApi} from "openai";
import {db} from "../database/db";
import {getEnv} from "../utils/GetEnv";
import {getConfig} from "./config";
import {mainServerId} from "./MainServerId";

export const OpenAICache: Record<string, OpenAIApi | undefined> = {};

const USE_SAME_API_KEY_FOR_ALL = getEnv('USE_SAME_API_KEY_FOR_ALL');

export async function getOpenAIForId(id: string): Promise<OpenAIApi | undefined> {
    if (USE_SAME_API_KEY_FOR_ALL === 'true' && id !== mainServerId) {
        return getOpenAIForId(mainServerId);
    }

    if (OpenAICache[id] === undefined) {
        if(id === mainServerId) {
            // try getting the api key from config

            const config = await getConfig();
            if(config.openAIApiKey) {
                OpenAICache[id] = new OpenAIApi(new Configuration({
                    apiKey: config.openAIApiKey,
                }));
            }
        } else {
            const apiKey = await db.get<string>(`CONFIG-API-KEY-${id}`);
            if (apiKey !== null) {
                OpenAICache[id] = new OpenAIApi(new Configuration({
                    apiKey: apiKey,
                }));
            }
        }
    }

    return OpenAICache[id];
}
