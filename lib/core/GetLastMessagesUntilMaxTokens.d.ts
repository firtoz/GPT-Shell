import { MessageHistoryItem } from "./MessageHistoryItem";
export declare const getLastMessagesUntilMaxTokens: <T extends Partial<MessageHistoryItem> & Pick<MessageHistoryItem, "numTokens">>(messageHistory: T[], maxTokens: number) => T[];
