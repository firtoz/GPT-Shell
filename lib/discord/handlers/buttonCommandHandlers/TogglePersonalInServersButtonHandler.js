"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TogglePersonalInServersButtonHandler = void 0;
const config_1 = require("../../../core/config");
exports.TogglePersonalInServersButtonHandler = {
    id: 'TogglePersonalInServersButtonHandler',
    async run(client, buttonInteraction) {
        await buttonInteraction.deferUpdate();
        const config = await (0, config_1.getConfigForId)(buttonInteraction.user.id);
        config.useKeyInServersToo = !config.useKeyInServersToo;
        await (0, config_1.setConfigForId)(buttonInteraction.user.id, config);
        await buttonInteraction.editReply({
            content: 'Saved!',
            components: [],
            embeds: [],
        });
    }
};
//# sourceMappingURL=TogglePersonalInServersButtonHandler.js.map