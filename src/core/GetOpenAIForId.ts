import {Configuration, OpenAIApi} from "openai";
import {db} from "../database/db";
import {getEnv} from "../utils/GetEnv";
import {getConfig, getConfigForId} from "./config";
import {mainServerId} from "./MainServerId";

export const OpenAICache: Record<string, OpenAIApi | undefined> = {};

const USE_SAME_API_KEY_FOR_ALL = getEnv('USE_SAME_API_KEY_FOR_ALL');

export async function getOpenAIForId(id: string): Promise<OpenAIApi | undefined> {
    if (USE_SAME_API_KEY_FOR_ALL === 'true' && id !== mainServerId) {
        return getOpenAIForId(mainServerId);
    }

    if (OpenAICache[id] === undefined) {
        const config = await getConfigForId(id);

        const openAIApiKey = config.openAIApiKey;
        if(openAIApiKey) {
            OpenAICache[id] = new OpenAIApi(new Configuration({
                apiKey: openAIApiKey,
            }));
        }
    }

    return OpenAICache[id];
}
