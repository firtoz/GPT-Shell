import {MessageHistoryItem} from "./MessageHistoryItem";
import _ from 'lodash';
import {messageToPromptPart} from "./ChatGPTConversation";
import {encodeLength} from "./EncodeLength";

export function getNumTokens(current: MessageHistoryItem) {
    if (current.fixedTokens) {
        return current.numTokens;
    }

    const number = encodeLength(messageToPromptPart(current));
    current.numTokens = number;
    current.fixedTokens = true;

    return number;
}

export const getLastMessagesUntilMaxTokens = (
    messageHistory: MessageHistoryItem[],
    maxTokens: number,
    includePartial: boolean = false,
): MessageHistoryItem[] => {
    let remainingTokens = maxTokens;

    if (messageHistory.length < 2) {
        return messageHistory;
    }

    let i = messageHistory.length - 1;
    const numTokens = getNumTokens(messageHistory[i]);
    if (numTokens > maxTokens) {
        return [];
    }

    while (i >= 0) {
        const current = messageHistory[i];

        const currentTokens = getNumTokens(current);
        if (remainingTokens - currentTokens < 0) {
            break;
        }

        remainingTokens -= currentTokens;
        i--;
    }

    const chosenItems = messageHistory.slice(i + 1);

    if (includePartial && i >= 0 && remainingTokens > 50) {
        const lastMessageClone = _.cloneDeep(messageHistory[i]);

        while (lastMessageClone.content.length > 50) {
            if (remainingTokens - getNumTokens(lastMessageClone) >= 0) {
                return [lastMessageClone].concat(chosenItems);
            }

            lastMessageClone.content = '<TRUNCATED>' + lastMessageClone.content.slice(50);
            const prompt = messageToPromptPart(lastMessageClone);
            lastMessageClone.numTokens = encodeLength(prompt);
        }
    }

    return chosenItems;
}
