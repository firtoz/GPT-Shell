import { PineconeClient } from "pinecone-client";
import { PineconeMetadata } from "./PineconeMetadata";
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
export declare const getPineconeClient: () => Promise<PineconeClient<PineconeMetadata> | null>;
export declare const trySavingPineconeOptions: (options: PineconeConfigOpts | null) => Promise<{
    success: true;
} | {
    success: false;
    message: string;
}>;
