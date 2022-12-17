import {ChatGPTConversationVersion0} from "../../../core/ChatGPTConversationVersion0";
import {logMessage} from "../../../utils/logMessage";
import {ChatGPTConversation} from "../../../core/ChatGPTConversation";

export function InitializeThreads() {
    ChatGPTConversationVersion0.initialiseAll()
        .catch(() => {
            logMessage('INITIALIZEThreads 1', 'Initialise error...');
        });
    ChatGPTConversation.initialiseAll()
        .catch(() => {
            logMessage('INITIALIZEThreads 2', 'Initialise error...');
        });
}
