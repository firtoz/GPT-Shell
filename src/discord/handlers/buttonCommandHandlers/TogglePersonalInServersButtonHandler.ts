import {ButtonCommand} from "../../ButtonCommand";
import {getConfigForId, setConfigForId} from "../../../core/config";

export const TogglePersonalInServersButtonHandler: ButtonCommand = {
    id: 'TogglePersonalInServersButtonHandler',
    async run(client, buttonInteraction) {
        await buttonInteraction.deferUpdate();

        const config = await getConfigForId(buttonInteraction.user.id);
        config.useKeyInServersToo = !config.useKeyInServersToo;
        await setConfigForId(buttonInteraction.user.id, config);

        await buttonInteraction.editReply({
            content: 'Saved!',
            components: [],
            embeds: [],
        });
    }
}
