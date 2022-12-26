import {Client, MessageComponentInteraction, ModalSubmitInteraction} from "discord.js";

export interface ModalConfig {
    id: string;

    show(interaction: MessageComponentInteraction): Promise<void>;

    run: (client: Client, interaction: ModalSubmitInteraction) => Promise<void>;

}
