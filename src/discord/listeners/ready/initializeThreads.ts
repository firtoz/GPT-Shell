import {Client, Collection, Message} from "discord.js";
import {ChatGPTConversationVersion0} from "../../../core/ChatGPTConversationVersion0";
import {logMessage} from "../../../utils/logMessage";
import {getWhimsicalResponse} from "./getWhimsicalResponse";
import {tryGetThread} from "./tryGetThread";
import {messageReceivedInThread} from "./message-handling/handleThread";
import {trySendingMessage} from "../../../core/TrySendingMessage";

export function InitializeThreads(client: Client<boolean>) {
    ChatGPTConversationVersion0.initialiseAll()
        .catch(() => {
            logMessage('INITIALIZEThreads', 'Initialise error...');
        });
}
