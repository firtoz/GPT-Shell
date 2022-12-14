"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Commands = void 0;
const ChatGptCommand_1 = require("./commands/ChatGptCommand");
const APIKeyCommand_1 = require("./commands/APIKeyCommand");
exports.Commands = [ChatGptCommand_1.ChatGptCommand];
if (APIKeyCommand_1.APIKeyCommand) {
    exports.Commands.push(APIKeyCommand_1.APIKeyCommand);
}
//# sourceMappingURL=Commands.js.map