"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Commands = void 0;
const ChatGptCommand_1 = require("./handlers/commands/ChatGptCommand");
const ConfigCommand_1 = require("./handlers/commands/ConfigCommand");
const CustomPromptCommand_1 = require("./handlers/commands/CustomPromptCommand");
const DrawCommand_1 = require("./handlers/commands/DrawCommand");
exports.Commands = [ChatGptCommand_1.ChatGptCommand];
if (ChatGptCommand_1.PrivateChatGptCommand) {
    exports.Commands.push(ChatGptCommand_1.PrivateChatGptCommand);
}
if (ConfigCommand_1.ConfigCommand) {
    exports.Commands.push(ConfigCommand_1.ConfigCommand);
}
if (CustomPromptCommand_1.CustomPromptCommand) {
    exports.Commands.push(CustomPromptCommand_1.CustomPromptCommand);
}
if (DrawCommand_1.DrawCommand) {
    exports.Commands.push(DrawCommand_1.DrawCommand);
}
//# sourceMappingURL=Commands.js.map