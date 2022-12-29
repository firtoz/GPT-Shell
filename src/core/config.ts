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


export type ConfigForIdType = {
    maxTokensForRecentMessages: number;
    modelInfo: Record<ModelName, {
        MAX_ALLOWED_TOKENS: number,
        MAX_TOKENS_PER_RESPONSE: number,
    }>;
    openAIApiKey: string | null;
    maxMessagePerUser: number;
    useKeyInServersToo: boolean;
    exceptionRoleIds: string[];
};

const defaultConfigForId: ConfigForIdType = {
    maxTokensForRecentMessages: 1000,
    modelInfo: {
        ['text-davinci-003']: {
            MAX_ALLOWED_TOKENS: 2000,
            MAX_TOKENS_PER_RESPONSE: 512,
        },
    },
    openAIApiKey: null,
    useKeyInServersToo: false,
    maxMessagePerUser: -1,
    exceptionRoleIds: [],
};

const serverConfigState: Record<string, ConfigForIdType | undefined> = {};

type MessageCounter = Record<string, {
    count: number,
    warned: boolean,
} | undefined>;

const messageCounterCache: Record<string, MessageCounter | undefined> = {};

export const getMessageCounter = async (id: string): Promise<MessageCounter> => {
    if (messageCounterCache[id] === undefined) {
        const counter = await db.get<MessageCounter>(`MESSAGE-COUNTER-${id}`);
        messageCounterCache[id] = counter ?? {};
    }

    return messageCounterCache[id]!;
}

export const saveMessageCounter = async (id: string, counter: MessageCounter) => {
    messageCounterCache[id] = counter;

    await db.set(`MESSAGE-COUNTER-${id}`, counter);
}

const getConfigForIdInternal = async (id: string) => {
    const defaultClone = _.cloneDeep(defaultConfigForId);

    defaultClone.openAIApiKey = await db.get<string>(`CONFIG-API-KEY-${id}`);

    const configFromDB = await db.get<ConfigForIdType>(`BOT-CONFIG-FOR-${id}`);
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

    return serverConfigState[id] as ConfigForIdType;
}

export const setConfigForId = async (id: string, value: ConfigForIdType) => {
    serverConfigState[id] = value;

    return await db.set(`BOT-CONFIG-FOR-${id}`, value);
}
