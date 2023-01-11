import {CreateCompletionResponseUsage, CreateEmbeddingResponseDataInner} from "openai";

export type MessageHistoryItem = ({
    type: 'human';
    userId: string;
} | {
    type: 'response';
    usageInfo?: CreateCompletionResponseUsage[];
}) & {
    id: string;
    timestamp: number | undefined;
    username: string;
    content: string;
    numTokens: number;
    embedding: null | string;
    fixedTokens: boolean | undefined;
};
