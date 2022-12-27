import {db} from "../database/db";
import _ from 'lodash';
import {ModelName} from "./ModelInfo";
import {getEnv} from "../utils/GetEnv";
import {PineconeConfigOpts} from "./pinecone";
import {mainServerId} from "./MainServerId";

export type ConfigType = {
    pineconeOptions: PineconeConfigOpts | null,
    maxMessagesToEmbed: number;
};


const OPENAI_API_KEY = getEnv('OPENAI_API_KEY');

const defaultConfig: ConfigType = {
    pineconeOptions: null,
    maxMessagesToEmbed: 300,
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



export type ServerConfigType = {
    maxTokensForRecentMessages: number;
    modelInfo: Record<ModelName, {
        MAX_ALLOWED_TOKENS: number,
        MAX_TOKENS_PER_RESPONSE: number,
    }>;
    openAIApiKey: string | null;
    maxMessagePerUser: number;
    exceptionRoleIds: string[];
};

const defaultServerConfig: ServerConfigType = {
    maxTokensForRecentMessages: 1000,
    modelInfo: {
        ['text-davinci-003']: {
            MAX_ALLOWED_TOKENS: 2000,
            MAX_TOKENS_PER_RESPONSE: 512,
        },
    },
    openAIApiKey: null,
    maxMessagePerUser: -1,
    exceptionRoleIds: [],
};

const serverConfigState: Record<string, ServerConfigType | undefined> = {};

const getConfigForIdInternal = async (id: string) => {
    const defaultClone = _.cloneDeep(defaultServerConfig);

    if(id === mainServerId) {
        defaultClone.openAIApiKey = OPENAI_API_KEY;
    } else {
        defaultClone.openAIApiKey = await db.get<string>(`CONFIG-API-KEY-${id}`);
    }

    const configFromDB = await db.get<ServerConfigType>(`BOT-CONFIG-FOR-${id}`);
    if (configFromDB) {
        return Object.assign(defaultClone, configFromDB);
    } else {
        await setConfigForId(id, defaultClone);
    }

    return defaultClone;
}

export const getConfigForId = async (id: string) => {
    if (serverConfigState[id] == undefined) {
        serverConfigState[id] = await getConfigForIdInternal(id);
    }

    return serverConfigState[id] as ServerConfigType;
}

export const setConfigForId = async (id: string, value: ServerConfigType) => {
    serverConfigState[id] = value;

    return await db.set(`BOT-CONFIG-FOR-${id}`, value);
}
