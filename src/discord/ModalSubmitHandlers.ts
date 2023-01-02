import {ModalConfig} from "./handlers/ModalConfig";
import {PineconeModal} from "./handlers/modals/PineconeModal";
import {EmbedLimitModal} from "./handlers/modals/EmbedLimitModal";
import {TokenLimitsModal} from "./handlers/modals/TokenLimitsModal";
import {OpenAIAPIKeyModal} from "./handlers/modals/OpenAIAPIKeyModal";
import {MessageLimitsModal} from "./handlers/modals/MessageLimitsModal";
import {ChatChannelsModal} from "./handlers/modals/ChatChannelsModal";
import {PromptPermissionsModal} from "./handlers/modals/PromptPermissionsModal";
import {CustomPromptModal} from "./handlers/modals/CustomPromptModal";
import {ModerationsModal} from "./handlers/modals/ModerationsModal";

export const ModalSubmitHandlers: ModalConfig<any>[] = [
    PineconeModal,
    EmbedLimitModal,
    TokenLimitsModal,
    OpenAIAPIKeyModal,
    MessageLimitsModal,
    ChatChannelsModal,
    PromptPermissionsModal,
    ModerationsModal,
    CustomPromptModal,
];
