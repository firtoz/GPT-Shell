import {Command} from "./Command";
import {ChatGptCommand, PrivateChatGptCommand} from "./handlers/commands/ChatGptCommand";
import {ConfigCommand} from "./handlers/commands/ConfigCommand";
import {CustomPromptCommand} from "./handlers/commands/CustomPromptCommand";

export const Commands: Command[] = [ChatGptCommand];

if (PrivateChatGptCommand) {
    Commands.push(PrivateChatGptCommand);
}

if (ConfigCommand) {
    Commands.push(ConfigCommand);
}

if(CustomPromptCommand) {
    Commands.push(CustomPromptCommand);
}


