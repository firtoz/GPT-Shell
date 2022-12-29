import {
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    MessageComponentInteraction,
    ModalBuilder,
    ModalSubmitInteraction,
    TextInputBuilder,
    TextInputStyle
} from "discord.js";
import {Narrow} from "ts-toolbelt/out/Function/Narrow";
import {ModalConfig} from "./ModalConfig";
import {logMessage} from "../../utils/logMessage";
import {EmbedLimitModal} from "./modals/EmbedLimitModal";

type ModalInput = {
    name: string;
    label: string;
    defaultValue: string;
    placeholder?: string;
    required: boolean;
    style: TextInputStyle;
};

type ModalValues<TInputs extends ModalInput[]> = { [K in TInputs[number]['name']]?: string };
export const defineModal = <TInputs extends ModalInput[]>(
    id: string,
    title: string,
    buttonConfig: {
        label: string,
        style?: ButtonStyle,
        textOnClick: string,
    },
    inputs: Narrow<TInputs>,
    getCurrentValues: (interaction: MessageComponentInteraction) => Promise<ModalValues<TInputs>>,
    onSubmit: (values: ModalValues<TInputs>, interaction: ModalSubmitInteraction) => void,
): ModalConfig => {
    const buttonId = id + '-button';

    const show = async (interaction: MessageComponentInteraction) => {
        const modal = new ModalBuilder()
            .setCustomId(id)
            .setTitle(title);

        try {
            const values = await getCurrentValues(interaction);

            modal.addComponents(inputs.map(input => {
                let inputBuilder = new TextInputBuilder()
                    .setCustomId(input.name)
                    .setLabel(input.label)
                    .setValue(values[input.name as keyof ModalValues<TInputs>] ?? '')
                    .setRequired(input.required)
                    .setStyle(input.style);

                if (input.placeholder) {
                    inputBuilder = inputBuilder.setPlaceholder(input.placeholder);
                }

                return new ActionRowBuilder<TextInputBuilder>().addComponents(inputBuilder);
            }))

            // Show the modal to the user
            await interaction.showModal(modal);
        } catch (e) {
            logMessage(`Failed to show modal for id ${id}`, e);
        }
    }
    return {
        id,
        buttonId,
        async run(client, submitInteraction) {
            await submitInteraction.deferReply({
                ephemeral: true,
            });

            const values: ModalValues<TInputs> = {};
            inputs.forEach(input => {
                values[input.name as keyof ModalValues<TInputs>] = submitInteraction.fields.getTextInputValue(input.name);
            });

            await onSubmit(values, submitInteraction);
        },
        getButtonComponent() {
            return new ButtonBuilder()
                .setCustomId(buttonId)
                .setLabel(buttonConfig.label)
                .setStyle(buttonConfig.style ?? ButtonStyle.Primary)
        },
        async onButtonClick(buttonInteraction) {
            await show(buttonInteraction);

            await buttonInteraction.editReply({
                content: buttonConfig.textOnClick,
                components: [],
                embeds: [],
            });
        }
    }
}
