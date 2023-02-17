"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.defineModal = void 0;
const discord_js_1 = require("discord.js");
const logMessage_1 = require("../../utils/logMessage");
const lodash_1 = __importDefault(require("lodash"));
const defineModal = (id, title, buttonConfig, inputs, getCurrentValues, onSubmit) => {
    const show = async (interaction) => {
        (0, logMessage_1.logMessage)(`Showing modal \`${id}\`: \`${title}\` for ${interaction.user.tag}.`);
        const modal = new discord_js_1.ModalBuilder()
            .setCustomId(id)
            .setTitle(title);
        try {
            const values = await getCurrentValues(interaction);
            modal.addComponents(inputs.filter(input => {
                const shouldShow = input.shouldShow;
                if (shouldShow) {
                    return shouldShow(interaction);
                }
                return true;
            }).map(input => {
                let inputBuilder = new discord_js_1.TextInputBuilder()
                    .setCustomId(input.name)
                    .setLabel(input.label)
                    .setValue(values[input.name] ?? '')
                    .setRequired(input.required)
                    .setStyle(input.style);
                if (input.minLength != undefined) {
                    inputBuilder = inputBuilder.setMinLength(input.minLength);
                }
                if (input.maxLength != undefined) {
                    inputBuilder = inputBuilder.setMaxLength(input.maxLength);
                }
                if (input.placeholder) {
                    inputBuilder = inputBuilder.setPlaceholder(input.placeholder);
                }
                return new discord_js_1.ActionRowBuilder().addComponents(inputBuilder);
            }));
            // Show the modal to the user
            return await interaction
                .showModal(modal)
                .then(() => true, (e) => {
                (0, logMessage_1.logMessage)(`Failed to show modal for id ${id}`, e);
                return false;
            });
        }
        catch (e) {
            (0, logMessage_1.logMessage)(`Failed to show modal for id ${id}`, e);
            return false;
        }
    };
    const result = {
        hasButton: false,
        id,
        show,
        async run(client, submitInteraction) {
            await submitInteraction.deferReply({
                ephemeral: true,
            });
            const values = {};
            const allFields = submitInteraction.fields.fields;
            (0, logMessage_1.logMessage)(`Submitted modal ${id}-${title} from ${submitInteraction.user.tag}: `, allFields);
            inputs.forEach(input => {
                if (allFields.get(input.name)) {
                    values[input.name] = submitInteraction.fields.getTextInputValue(input.name);
                }
                else {
                    values[input.name] = '';
                }
            });
            await onSubmit(values, submitInteraction);
        }
    };
    if (buttonConfig !== null) {
        const buttonId = id + '-button';
        const newResult = {
            ...lodash_1.default.omit(result, "show"),
            hasButton: true,
            buttonId,
            getButtonComponent() {
                return new discord_js_1.ButtonBuilder()
                    .setCustomId(buttonId)
                    .setLabel(buttonConfig.label)
                    .setStyle(buttonConfig.style ?? discord_js_1.ButtonStyle.Primary);
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
        return newResult;
    }
    else {
        return result;
    }
};
exports.defineModal = defineModal;
//# sourceMappingURL=DefineModal.js.map