import {db} from "../database/db";
import _ from 'lodash';
import {ModelName} from "./ModelInfo";
import {getEnv} from "../utils/GetEnv";
import {PineconeConfigOpts} from "./pinecone";

export type ConfigType = {
    pineconeOptions: PineconeConfigOpts | null,
    maxMessagesToEmbed: number;
    maxTokensForRecentMessages: number;
    modelInfo: Record<ModelName, {
        MAX_ALLOWED_TOKENS: number,
        MAX_TOKENS_PER_RESPONSE: number,
    }>;
    openAIApiKey: string | null;
};

const OPENAI_API_KEY = getEnv('OPENAI_API_KEY');

const defaultConfig: ConfigType = {
    pineconeOptions: null,
    maxMessagesToEmbed: 300,
    maxTokensForRecentMessages: 1000,
    modelInfo: {
        ['text-davinci-003']: {
            MAX_ALLOWED_TOKENS: 2500,
            MAX_TOKENS_PER_RESPONSE: 512,
        },
    },
    openAIApiKey: OPENAI_API_KEY,
};

const getConfigInternal = async () => {
    const defaultClone = _.cloneDeep(defaultConfig);

    const configFromDB = await db.get<ConfigType>('BOT-CONFIG');
    if (configFromDB) {
        return Object.assign(defaultClone, configFromDB);
    }

    return defaultClone;
}

let configState: ConfigType | null = null;
export const getConfig = async () => {
    if (configState === null) {
        configState = await getConfigInternal();
    }

    return configState;
}

export const setConfig = async (value: ConfigType) => {
    configState = value;

    return await db.set('BOT-CONFIG', value);
}
