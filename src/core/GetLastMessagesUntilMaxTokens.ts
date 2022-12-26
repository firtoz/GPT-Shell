import {MessageHistoryItem} from "./MessageHistoryItem";
import _ from 'lodash';
import {messageToPromptPart} from "./ChatGPTConversation";
import {encodeLength} from "./EncodeLength";

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
    if (messageHistory[i].numTokens > maxTokens) {
        return [];
    }

    while (i >= 0) {
        const current = messageHistory[i];

        if (remainingTokens - current.numTokens < 0) {
            break;
        }

        remainingTokens -= current.numTokens;
        i--;
    }

    const chosenItems = messageHistory.slice(i + 1);

    if (includePartial && i >= 0 && remainingTokens > 50) {
        const lastMessageClone = _.cloneDeep(messageHistory[i]);

        while (lastMessageClone.content.length > 50) {
            if (remainingTokens - lastMessageClone.numTokens >= 0) {
                return [lastMessageClone].concat(chosenItems);
            }

            lastMessageClone.content = '<TRUNCATED>' + lastMessageClone.content.slice(50);
            const prompt = messageToPromptPart(lastMessageClone);
            lastMessageClone.numTokens = encodeLength(prompt);
        }
    }

    return chosenItems;
}
