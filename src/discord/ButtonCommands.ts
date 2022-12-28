import {PineconeButtonHandler} from "./handlers/buttons/PineconeButtonHandler";
import {ButtonCommand} from "./ButtonCommand";
import {EmbedLimitButtonHandler} from "./handlers/buttons/EmbedLimitButtonHandler";
import {TokenLimitsButtonHandler} from "./handlers/buttons/TokenLimitsButtonHandler";
import {OpenAIAPIKeyButtonHandler} from "./handlers/buttons/OpenAIAPIKeyButtonHandler";

export const ButtonCommands: ButtonCommand[] = [
    PineconeButtonHandler,
    EmbedLimitButtonHandler,
    TokenLimitsButtonHandler,
    OpenAIAPIKeyButtonHandler,
];

