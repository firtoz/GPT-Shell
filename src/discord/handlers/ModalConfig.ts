import {
    ButtonBuilder,
    ButtonInteraction, ButtonStyle,
    Client, CommandInteraction, MessageComponentInteraction,
    ModalSubmitInteraction
} from "discord.js";

export type ModalButtonConfig = {
    label: string,
    style?: ButtonStyle,
    textOnClick: string,
};

export type ModalConfig<TWithButton extends true | false> = {
    id: string;
    run: (client: Client, interaction: ModalSubmitInteraction) => Promise<void>;
} & (TWithButton extends false ? {
    hasButton: false,
    show (interaction: MessageComponentInteraction | CommandInteraction): Promise<boolean>,
} : {
    hasButton: true,
    buttonId: string;
    getButtonComponent(): ButtonBuilder;
    onButtonClick(buttonInteraction: ButtonInteraction): Promise<void>;
});
