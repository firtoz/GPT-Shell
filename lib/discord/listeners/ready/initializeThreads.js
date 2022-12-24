"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InitializeThreads = void 0;
const ChatGPTConversationVersion0_1 = require("../../../core/ChatGPTConversationVersion0");
const logMessage_1 = require("../../../utils/logMessage");
const ChatGPTConversation_1 = require("../../../core/ChatGPTConversation");
function InitializeThreads() {
    ChatGPTConversationVersion0_1.ChatGPTConversationVersion0.initialiseAll()
        .catch(() => {
        (0, logMessage_1.logMessage)('INITIALIZEThreads 1', 'Initialise error...');
    });
    ChatGPTConversation_1.ChatGPTConversation.initialiseAll()
        .catch(() => {
        (0, logMessage_1.logMessage)('INITIALIZEThreads 2', 'Initialise error...');
    });
}
exports.InitializeThreads = InitializeThreads;
//# sourceMappingURL=initializeThreads.js.map