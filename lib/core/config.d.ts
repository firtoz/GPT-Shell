import { ModelName } from "./ModelInfo";
import { PineconeConfigOpts } from "./pinecone";
import { CreateModerationResponseResultsInnerCategoryScores } from "openai";
export type ConfigType = {
    pineconeOptions: PineconeConfigOpts | null;
    maxMessagesToEmbed: number;
    promptPermissions: string[];
    moderationThreshold: CreateModerationResponseResultsInnerCategoryScores;
};
export declare function getDefaultModerationThresholds(): CreateModerationResponseResultsInnerCategoryScores;
export declare const getConfig: () => Promise<ConfigType>;
export declare const setConfig: (value: ConfigType) => Promise<void>;
export type ConfigForIdType = {
    maxTokensForRecentMessages: number;
    modelInfo: Record<ModelName, {
        MAX_ALLOWED_TOKENS: number;
        MAX_TOKENS_PER_RESPONSE: number;
    }>;
    openAIApiKey: string | null;
    maxMessagePerUser: number;
    messageExpiredNote: string;
    maxImagePerUser: number;
    useKeyInServersToo: boolean;
    chatChannelIds: string[];
    exceptionRoleIds: string[];
};
export type MessageCountInfo = {
    count: number;
    limitCount: number;
    warned: boolean;
    nextReset: number;
    imageCount: number;
    imageLimitCount: number;
};
export type MessageCounter = Record<string, MessageCountInfo | undefined>;
export declare const getMessageCounter: (id: string) => Promise<MessageCounter>;
export declare const saveMessageCounter: (id: string, counter: MessageCounter) => Promise<void>;
export declare const getConfigForId: (id: string) => Promise<ConfigForIdType>;
export declare const setConfigForId: (id: string, value: ConfigForIdType) => Promise<void>;
