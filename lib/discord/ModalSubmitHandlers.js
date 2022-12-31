"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ModalSubmitHandlers = void 0;
const PineconeModal_1 = require("./handlers/modals/PineconeModal");
const EmbedLimitModal_1 = require("./handlers/modals/EmbedLimitModal");
const TokenLimitsModal_1 = require("./handlers/modals/TokenLimitsModal");
const OpenAIAPIKeyModal_1 = require("./handlers/modals/OpenAIAPIKeyModal");
const MessageLimitsModal_1 = require("./handlers/modals/MessageLimitsModal");
const ChatChannelsModal_1 = require("./handlers/modals/ChatChannelsModal");
const PromptPermissionsModal_1 = require("./handlers/modals/PromptPermissionsModal");
const CustomPromptModal_1 = require("./handlers/modals/CustomPromptModal");
exports.ModalSubmitHandlers = [
    PineconeModal_1.PineconeModal,
    EmbedLimitModal_1.EmbedLimitModal,
    TokenLimitsModal_1.TokenLimitsModal,
    OpenAIAPIKeyModal_1.OpenAIAPIKeyModal,
    MessageLimitsModal_1.MessageLimitsModal,
    ChatChannelsModal_1.ChatChannelsModal,
    PromptPermissionsModal_1.PromptPermissionsModal,
    CustomPromptModal_1.CustomPromptModal,
];
//# sourceMappingURL=ModalSubmitHandlers.js.map