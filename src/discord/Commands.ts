import {Command} from "./Command";
import {ChatGptCommand} from "./handlers/commands/ChatGptCommand";
import {ConfigCommand} from "./handlers/commands/ConfigCommand";

export const Commands: Command[] = [ChatGptCommand];

if (ConfigCommand) {
    Commands.push(ConfigCommand);
}

