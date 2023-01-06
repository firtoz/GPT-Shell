import {PineconeClient} from "pinecone-client";
import {PineconeMetadata} from "./PineconeMetadata";
import {logMessage} from "../utils/logMessage";
import {getConfig, setConfig} from "./config";

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
            logMessage('Successfully created pinecone client!');
        } catch (e) {
            logMessage('Cannot create pinecone client...', e);
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

        logMessage('Successfully created pinecone client!');

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
