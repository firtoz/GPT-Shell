import { CreateEmbeddingResponseDataInner } from "openai";
export type MessageHistoryItem = ({
    type: 'human';
    userId: string;
} | {
    type: 'response';
}) & {
    timestamp: number | undefined;
    username: string;
    content: string;
    numTokens: number;
    embedding: null | CreateEmbeddingResponseDataInner[];
};