import {PineconeButtonHandler} from "./commands/PineconeButtonHandler";
import {PineconeModal} from "./commands/PineconeModal";
import {ModalConfig} from "./ModalConfig";
import {ButtonCommand} from "./ButtonCommand";
import {EmbedLimitButtonHandler} from "./commands/EmbedLimitButtonHandler";
import {EmbedLimitModal} from "./commands/EmbedLimitModal";
import {OpenAIAPIKeyModal, TokenLimitsModal} from "./commands/TokenLimitsModal";
import {OpenAIAPIKeyButtonHandler, TokenLimitsButtonHandler} from "./commands/TokenLimitsButtonHandler";

export const ButtonCommands: ButtonCommand[] = [
    PineconeButtonHandler,
    EmbedLimitButtonHandler,
    TokenLimitsButtonHandler,
    OpenAIAPIKeyButtonHandler,
];

export const ModalSubmitHandlers: ModalConfig[] = [
    PineconeModal,
    EmbedLimitModal,
    TokenLimitsModal,
    OpenAIAPIKeyModal,
];
