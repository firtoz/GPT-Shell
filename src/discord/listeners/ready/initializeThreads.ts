import {Client} from "discord.js";
import {ChatGPTConversationVersion0} from "../../../core/ChatGPTConversationVersion0";
import {logMessage} from "../../../utils/logMessage";

export function InitializeThreads() {
    ChatGPTConversationVersion0.initialiseAll()
        .catch(() => {
            logMessage('INITIALIZEThreads', 'Initialise error...');
        });
}
