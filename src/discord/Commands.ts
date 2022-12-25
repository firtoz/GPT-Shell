import {ButtonCommand, Command} from "./Command";
import {ChatGptCommand} from "./commands/ChatGptCommand";
import {APIKeyCommand} from "./commands/APIKeyCommand";
import {ConfigCommand} from "./commands/ConfigCommand";
import {PineconeButtonCommand} from "./commands/PineconeButtonCommand";

export const Commands: Command[] = [ChatGptCommand];

if (APIKeyCommand) {
    Commands.push(APIKeyCommand);
}

if (ConfigCommand) {
    Commands.push(ConfigCommand);
}

export const ButtonCommands: ButtonCommand[] = [
    PineconeButtonCommand,
];
