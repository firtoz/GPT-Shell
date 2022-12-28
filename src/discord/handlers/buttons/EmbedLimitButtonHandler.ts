import {ButtonCommand} from "../../ButtonCommand";
import {EmbedLimitModal} from "../modals/EmbedLimitModal";

const embedLimitId = 'SET-EMBED-LIMIT';
export const EmbedLimitButtonHandler: ButtonCommand = {
    id: embedLimitId,
    async run(client, buttonInteraction) {
        await EmbedLimitModal.show(buttonInteraction);

        await buttonInteraction.editReply({
            content: 'Updating Embed Limit...',
            components: [],
            embeds: [],
        });
    }
}


