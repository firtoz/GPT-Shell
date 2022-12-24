"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLastMessagesUntilMaxTokens = void 0;
const getLastMessagesUntilMaxTokens = (messageHistory, maxTokens) => {
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
        }
        else {
            break;
        }
        i--;
    }
    return messageHistory.slice(i + 1);
};
exports.getLastMessagesUntilMaxTokens = getLastMessagesUntilMaxTokens;
//# sourceMappingURL=GetLastMessagesUntilMaxTokens.js.map