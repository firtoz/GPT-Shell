import {Command} from "./Command";
import {ChatGptCommand} from "./commands/ChatGptCommand";
import {APIKeyCommand} from "./commands/APIKeyCommand";
import {ConfigCommand} from "./commands/ConfigCommand";

export const Commands: Command[] = [ChatGptCommand];

if (APIKeyCommand) {
    Commands.push(APIKeyCommand);
}

if (ConfigCommand) {
    Commands.push(ConfigCommand);
}

