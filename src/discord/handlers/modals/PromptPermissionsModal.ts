import {defineModal} from "../DefineModal";
import {EmbedBuilder, TextInputStyle} from "discord.js";
import {getConfig, setConfig} from "../../../core/config";

export const PromptPermissionsModal = defineModal(
    'PROMPT-PERMISSIONS-MODAL',
    'Prompt Permissions',
    {
        label: 'Change Prompt Permissions',
        textOnClick: 'Updating Prompt Permissions...',
    },
    [{
        name: 'promptPermissions',
        label: 'Permission IDs (server/user)',
        defaultValue: '',
        placeholder: '[ID1]\n[ID2]',
        required: false,
        style: TextInputStyle.Paragraph,
    }], async () => {
        const config = await getConfig();

        return {
            promptPermissions: `${config.promptPermissions.join('\n')}`
        };
    },
    async (values, submitInteraction) => {
        try {
            const config = await getConfig();

            const {promptPermissions} = values;

            config.promptPermissions = (promptPermissions ?? '')
                .split('\n')
                .map(item => item.trim())
                .filter(item => item.length > 0);

            await setConfig(config);

            await submitInteraction.followUp({
                content: '',
                embeds: [
                    new EmbedBuilder()
                        .setDescription(`Updated.

People or servers with permissions:

${config.promptPermissions.join('\n')}`)
                        .setColor(0x00ff00)
                ],
                components: [],
            });
        } catch (e: any) {
            await submitInteraction.followUp({
                content: 'Failure to save',
                embeds: e.message ? [
                    new EmbedBuilder()
                        .setDescription(e.message)
                        .setColor(0xff0000)
                ] : [],
                components: [],
            });
        }
    });
