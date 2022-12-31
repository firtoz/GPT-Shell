"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLastMessagesUntilMaxTokens = void 0;
const lodash_1 = __importDefault(require("lodash"));
const ChatGPTConversation_1 = require("./ChatGPTConversation");
const EncodeLength_1 = require("./EncodeLength");
const getLastMessagesUntilMaxTokens = (messageHistory, maxTokens, includePartial = false) => {
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
        const lastMessageClone = lodash_1.default.cloneDeep(messageHistory[i]);
        while (lastMessageClone.content.length > 50) {
            if (remainingTokens - lastMessageClone.numTokens >= 0) {
                return [lastMessageClone].concat(chosenItems);
            }
            lastMessageClone.content = '<TRUNCATED>' + lastMessageClone.content.slice(50);
            const prompt = (0, ChatGPTConversation_1.messageToPromptPart)(lastMessageClone);
            lastMessageClone.numTokens = (0, EncodeLength_1.encodeLength)(prompt);
        }
    }
    return chosenItems;
};
exports.getLastMessagesUntilMaxTokens = getLastMessagesUntilMaxTokens;
//# sourceMappingURL=GetLastMessagesUntilMaxTokens.js.map