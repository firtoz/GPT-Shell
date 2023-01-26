import {
    ActionRowBuilder,
    APITextInputComponent,
    ButtonBuilder,
    ButtonStyle, CommandInteraction,
    MessageComponentInteraction,
    ModalBuilder,
    ModalSubmitInteraction,
    TextInputBuilder,
    TextInputStyle
} from "discord.js";
import {Narrow} from "ts-toolbelt/out/Function/Narrow";
import {ModalButtonConfig, ModalConfig} from "./ModalConfig";
import {logMessage} from "../../utils/logMessage";
import _ from "lodash";

type ModalInput = {
    name: string;
    label: string;
    defaultValue: string;
    placeholder?: string;
    required: boolean;
    style: TextInputStyle;
    minLength?: number;
    maxLength?: number;
    shouldShow?: (interaction: MessageComponentInteraction | CommandInteraction) => boolean,
};

type ModalValues<TInputs extends ModalInput[]> = { [K in TInputs[number]['name']]?: string };

export const defineModal = <TInputs extends ModalInput[], TButtonConfig extends ModalButtonConfig | null>(
    id: string,
    title: string,
    buttonConfig: TButtonConfig,
    inputs: Narrow<TInputs>,
    getCurrentValues: (interaction: MessageComponentInteraction | CommandInteraction) => Promise<ModalValues<TInputs>>,
    onSubmit: (values: ModalValues<TInputs>, interaction: ModalSubmitInteraction) => void,
): ModalConfig<TButtonConfig extends null ? false : true> => {
    const show = async (interaction: MessageComponentInteraction | CommandInteraction) => {
        logMessage(`Showing modal \`${id}\`: \`${title}\` for ${interaction.user.tag}.`)

        const modal = new ModalBuilder()
            .setCustomId(id)
            .setTitle(title);

        try {
            const values = await getCurrentValues(interaction);

            modal.addComponents(inputs.filter(input => {
                const shouldShow = input.shouldShow as (interaction: MessageComponentInteraction | CommandInteraction) => boolean;

                if (shouldShow) {
                    return shouldShow(interaction);
                }

                return true;
            }).map(input => {
                let inputBuilder = new TextInputBuilder()
                    .setCustomId(input.name)
                    .setLabel(input.label)
                    .setValue(values[input.name as keyof ModalValues<TInputs>] ?? '')
                    .setRequired(input.required)
                    .setStyle(input.style);

                if (input.minLength != undefined) {
                    inputBuilder = inputBuilder.setMinLength(input.minLength)
                }

                if (input.maxLength != undefined) {
                    inputBuilder = inputBuilder.setMaxLength(input.maxLength)
                }

                if (input.placeholder) {
                    inputBuilder = inputBuilder.setPlaceholder(input.placeholder);
                }

                return new ActionRowBuilder<TextInputBuilder>().addComponents(inputBuilder);
            }))

            // Show the modal to the user
            return await interaction
                .showModal(modal)
                .then(() => true, (e) => {
                    logMessage(`Failed to show modal for id ${id}`, e);

                    return false;
                });
        } catch (e) {
            logMessage(`Failed to show modal for id ${id}`, e);

            return false;
        }
    }

    const result: ModalConfig<false> = {
        hasButton: false,
        id,
        show,
        async run(client, submitInteraction) {
            await submitInteraction.deferReply({
                ephemeral: true,
            });

            const values: ModalValues<TInputs> = {};
            const allFields = submitInteraction.fields.fields;

            logMessage(`Submitted modal ${id}-${title} from ${submitInteraction.user.tag}: `, allFields);

            inputs.forEach(input => {
                if (allFields.get(input.name)) {
                    values[input.name as keyof ModalValues<TInputs>] = submitInteraction.fields.getTextInputValue(input.name);
                } else {
                    values[input.name as keyof ModalValues<TInputs>] = '';
                }
            });

            await onSubmit(values, submitInteraction);
        }
    };

    if (buttonConfig !== null) {
        const buttonId = id + '-button';

        const newResult: ModalConfig<true> = {
            ..._.omit(result, "show"),
            hasButton: true,
            buttonId,
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
        };

        return newResult as any;
    } else {
        return result as any;
    }
}
