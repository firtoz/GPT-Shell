import {db} from "../database/db";
import {PineconeClient} from "pinecone-client";
import {PineconeMetadata} from "./PineconeMetadata";
import {logMessage} from "../utils/logMessage";
import _ from 'lodash';
import {ModelName} from "./ModelInfo";
import {getEnv} from "../utils/GetEnv";

export type PineconeConfigOpts = {
    /**
     * The API key used to authenticate with the Pinecone API.
     * Get yours from the Pinecone console: https://app.pinecone.io/
     */
    apiKey?: string;
    /**
     * The HTTP endpoint for the Pinecone index.
     * Use an empty string if there is no baseUrl yet because the index is being created.
     * @see https://www.pinecone.io/docs/manage-data/#specify-an-index-endpoint
     */
    baseUrl?: string;
    /**
     * The index namespace to use for all requests. This can't be changed after
     * the client is created to ensure metadata type safety.
     * @see https://www.pinecone.io/docs/namespaces/
     */
    namespace?: string;
};

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

export const getConfig = async () => {
    const defaultClone = _.cloneDeep(defaultConfig);

    const configFromDB = await db.get<ConfigType>('BOT-CONFIG');
    if (configFromDB) {
        return Object.assign(defaultClone, configFromDB);
    }

    return defaultClone;
}

/**
 * If undefined, then need to find it.
 *
 * If null, the not set.
 */
let pineconeClientCache: undefined | null | PineconeClient<PineconeMetadata>;

export const getPineconeClient: () => Promise<PineconeClient<PineconeMetadata> | null> = async () => {
    if (pineconeClientCache !== undefined) {
        return pineconeClientCache;
    }

    const config = await getConfig();
    const pineconeOptions = config.pineconeOptions;
    if (pineconeOptions) {
        const testClient = new PineconeClient<PineconeMetadata>(pineconeOptions);

        try {
            await testClient.describeIndexStats();

            pineconeClientCache = testClient;
        } catch (e) {
            logMessage('Cannot create pinecone client...');
            pineconeClientCache = null;
        }
    } else {
        pineconeClientCache = null;
    }

    return pineconeClientCache;
}

export const trySavingPineconeOptions = async (options: PineconeConfigOpts | null): Promise<{ success: true } | { success: false, message: string }> => {
    if (options === null) {
        // then remove the association
        pineconeClientCache = null;

        const config = await getConfig();
        config.pineconeOptions = null;
        await setConfig(config);
        return {
            success: true,
        };
    }

    const testClient = new PineconeClient<PineconeMetadata>(options);

    try {
        await testClient.describeIndexStats();

        pineconeClientCache = testClient;

        const config = await getConfig();
        config.pineconeOptions = options;
        await setConfig(config);

        return {
            success: true,
        };
    } catch (e: any) {
        logMessage('Cannot create pinecone client...', e);

        return {
            success: false,
            message: e.message,
        }
    }
}

export const setConfig = async (value: ConfigType) => {


    return await db.set('BOT-CONFIG', value);
}
