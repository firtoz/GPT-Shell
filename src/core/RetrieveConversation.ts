import {conversationCache} from "./ConversationCache";
import {db} from "../database/db";
import {ChatGPTConversation} from "./ChatGPTConversation";
import {ChatGPTConversationVersion0} from "./ChatGPTConversationVersion0";
import {BaseConversation} from "./BaseConversation";

export const retrieveConversation = async (threadId: string): Promise<BaseConversation | null> => {
    const inCache = conversationCache[threadId];
    if (inCache !== undefined) {
        // either null or exists
        // if null, not our thread
        return inCache;
    }

    const fromDb = await db.get<BaseConversation>(BaseConversation.getDBKey(threadId));

    let result: BaseConversation | null = null;

    if (fromDb != null) {
        if ((fromDb as ChatGPTConversation).version !== undefined) {
            result = await ChatGPTConversation.handleRetrievalFromDB(fromDb as ChatGPTConversation);
        } else {
            result = await ChatGPTConversationVersion0.handleRetrievalFromDB(fromDb as any);
        }
    }

    conversationCache[threadId] = result;

    return null;
}
