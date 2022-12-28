import {logMessage} from "../../../utils/logMessage";
import {ChatGPTConversation} from "../../../core/ChatGPTConversation";

export function InitializeThreads() {
    ChatGPTConversation.initialiseAll()
        .catch(() => {
            logMessage('INITIALIZEThreads 2', 'Initialise error...');
        });
}
