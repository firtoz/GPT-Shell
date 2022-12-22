import {MessageHistoryItem} from "./MessageHistoryItem";

export const getLastMessagesUntilMaxTokens = <T extends (Partial<MessageHistoryItem> & Pick<MessageHistoryItem, 'numTokens'>)>(
    messageHistory: T[],
    maxTokens: number,
): T[] => {
    let sum = 0;

    if (messageHistory.length < 1) {
        return messageHistory;
    }

    let i = messageHistory.length - 1;
    if (messageHistory[i].numTokens > maxTokens) {
        return [];
    }

    while (i >= 0) {
        let current = messageHistory[i];
        if (sum + current.numTokens <= maxTokens) {
            sum += current.numTokens;
        } else {
            break;
        }
        i--;
    }

    return messageHistory.slice(i + 1);
}
