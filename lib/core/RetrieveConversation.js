"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.retrieveConversation = void 0;
const ConversationCache_1 = require("./ConversationCache");
const db_1 = require("../database/db");
const ChatGPTConversation_1 = require("./ChatGPTConversation");
const BaseConversation_1 = require("./BaseConversation");
const retrieveConversation = async (threadId) => {
    const inCache = ConversationCache_1.conversationCache[threadId];
    if (inCache !== undefined) {
        // either null or exists
        // if null, not our thread
        return inCache;
    }
    const fromDb = await db_1.db.get(BaseConversation_1.BaseConversation.getDBKey(threadId));
    let result = null;
    if (fromDb != null) {
        if (fromDb.version !== undefined) {
            result = await ChatGPTConversation_1.ChatGPTConversation.handleRetrievalFromDB(fromDb);
        }
        else {
            result = null;
        }
    }
    ConversationCache_1.conversationCache[threadId] = result;
    return result;
};
exports.retrieveConversation = retrieveConversation;
//# sourceMappingURL=RetrieveConversation.js.map