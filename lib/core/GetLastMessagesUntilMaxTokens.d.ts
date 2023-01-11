import { MessageHistoryItem } from "./MessageHistoryItem";
export declare function getNumTokens(current: MessageHistoryItem): number;
export declare const getLastMessagesUntilMaxTokens: (messageHistory: MessageHistoryItem[], maxTokens: number, includePartial?: boolean) => MessageHistoryItem[];
