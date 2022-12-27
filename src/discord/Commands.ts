import {Command} from "./Command";
import {ChatGptCommand} from "./commands/ChatGptCommand";
import {ConfigCommand} from "./commands/ConfigCommand";

export const Commands: Command[] = [ChatGptCommand];

if (ConfigCommand) {
    Commands.push(ConfigCommand);
}

