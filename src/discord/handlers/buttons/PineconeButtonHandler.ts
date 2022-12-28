import {TextInputStyle} from "discord.js";
import {PineconeModal} from "../modals/PineconeModal";
import {ButtonCommand} from "../../ButtonCommand";

const pineconeButtonId = 'SET-PINECONE-BUTTON';
export const PineconeButtonHandler: ButtonCommand = {
    id: pineconeButtonId,
    async run(client, buttonInteraction) {
        await PineconeModal.show(buttonInteraction);

        await buttonInteraction.editReply({
            content: 'Updating Pinecone config...',
            components: [],
            embeds: [],
        });
    }
}

