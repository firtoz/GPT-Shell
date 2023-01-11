"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getLastMessagesUntilMaxTokens = exports.getNumTokens = void 0;
const lodash_1 = __importDefault(require("lodash"));
const ChatGPTConversation_1 = require("./ChatGPTConversation");
const EncodeLength_1 = require("./EncodeLength");
function getNumTokens(current) {
    if (current.fixedTokens) {
        return current.numTokens;
    }
    const number = (0, EncodeLength_1.encodeLength)((0, ChatGPTConversation_1.messageToPromptPart)(current));
    current.numTokens = number;
    current.fixedTokens = true;
    return number;
}
exports.getNumTokens = getNumTokens;
const getLastMessagesUntilMaxTokens = (messageHistory, maxTokens, includePartial = false) => {
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
        const lastMessageClone = lodash_1.default.cloneDeep(messageHistory[i]);
        while (lastMessageClone.content.length > 50) {
            if (remainingTokens - getNumTokens(lastMessageClone) >= 0) {
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