import {ButtonCommand} from "../ButtonCommand";
import {TokenLimitsModal} from "./TokenLimitsModal";
import {OpenAIAPIKeyModal} from "./OpenAIAPIKeyModal";

export const TokenLimitsButtonHandler: ButtonCommand = {
    id: 'SET-TOKEN-LIMITS',
    async run(client, buttonInteraction) {
        await TokenLimitsModal.show(buttonInteraction);

        await buttonInteraction.editReply({
            content: 'Updating Token Limits...',
            components: [],
            embeds: [],
        });
    }
}
export const OpenAIAPIKeyButtonHandler: ButtonCommand = {
    id: 'SET-OPENAI-API-KEY',
    async run(client, buttonInteraction) {
        await OpenAIAPIKeyModal.show(buttonInteraction);

        await buttonInteraction.editReply({
            content: 'Updating OpenAI API Key...',
            components: [],
            embeds: [],
        });
    }
}
