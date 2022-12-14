import { Command } from "./Command";
import {ChatGptCommand} from "./commands/ChatGptCommand";
import {APIKeyCommand} from "./commands/APIKeyCommand";

export const Commands: Command[] = [ChatGptCommand];

if(APIKeyCommand) {
    Commands.push(APIKeyCommand);
}

