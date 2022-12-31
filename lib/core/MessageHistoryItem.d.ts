export type MessageHistoryItem = ({
    type: 'human';
    userId: string;
} | {
    type: 'response';
}) & {
    id: string;
    timestamp: number | undefined;
    username: string;
    content: string;
    numTokens: number;
    embedding: null | string;
};
