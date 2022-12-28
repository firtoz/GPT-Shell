import {ButtonCommand} from "../../ButtonCommand";
import {TokenLimitsModal} from "../modals/TokenLimitsModal";

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
