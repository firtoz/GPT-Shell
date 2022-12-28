import {
    ButtonBuilder,
    ButtonInteraction,
    Client,
    ModalSubmitInteraction
} from "discord.js";

export interface ModalConfig {
    id: string;
    buttonId: string;
    run: (client: Client, interaction: ModalSubmitInteraction) => Promise<void>;

    getButtonComponent(): ButtonBuilder;

    onButtonClick(buttonInteraction: ButtonInteraction): Promise<void>;
}
