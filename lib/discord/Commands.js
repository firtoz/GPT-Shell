"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Commands = void 0;
const ChatGptCommand_1 = require("./handlers/commands/ChatGptCommand");
const ConfigCommand_1 = require("./handlers/commands/ConfigCommand");
const CustomPromptCommand_1 = require("./handlers/commands/CustomPromptCommand");
exports.Commands = [ChatGptCommand_1.ChatGptCommand];
if (ConfigCommand_1.ConfigCommand) {
    exports.Commands.push(ConfigCommand_1.ConfigCommand);
}
if (CustomPromptCommand_1.CustomPromptCommand) {
    exports.Commands.push(CustomPromptCommand_1.CustomPromptCommand);
}
//# sourceMappingURL=Commands.js.map