import {ModalConfig} from "./handlers/ModalConfig";
import {PineconeModal} from "./handlers/modals/PineconeModal";
import {EmbedLimitModal} from "./handlers/modals/EmbedLimitModal";
import {TokenLimitsModal} from "./handlers/modals/TokenLimitsModal";
import {OpenAIAPIKeyModal} from "./handlers/modals/OpenAIAPIKeyModal";
import {MessageLimitsModal} from "./handlers/modals/MessageLimitsModal";
import {ChatChannelsModal} from "./handlers/modals/ChatChannelsModal";

export const ModalSubmitHandlers: ModalConfig[] = [
    PineconeModal,
    EmbedLimitModal,
    TokenLimitsModal,
    OpenAIAPIKeyModal,
    MessageLimitsModal,
    ChatChannelsModal,
];
