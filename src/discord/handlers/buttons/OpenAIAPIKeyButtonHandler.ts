import {ButtonCommand} from "../../ButtonCommand";
import {OpenAIAPIKeyModal} from "../modals/OpenAIAPIKeyModal";

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
