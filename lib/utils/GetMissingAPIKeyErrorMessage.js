"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMissingAPIKeyErrorMessage = void 0;
const GetEnv_1 = require("./GetEnv");
const API_KEY_COMMAND_NAME = (0, GetEnv_1.getEnv)('API_KEY_COMMAND_NAME');
async function getMissingAPIKeyErrorMessage(isDM) {
    let errorMessage = `[[
Could not find OpenAI API Key for this ${isDM ? 'user' : 'server'}.`;
    if (API_KEY_COMMAND_NAME) {
        if (isDM) {
            errorMessage += `\nPlease provide an OpenAI API key using \`/${API_KEY_COMMAND_NAME} [OPENAI_API_KEY]\` to continue.`;
        }
        else {
            errorMessage += `\nPlease ask an administrator to provide an OpenAI API key using \`/${API_KEY_COMMAND_NAME} [OPENAI_API_KEY]\` to continue.`;
            errorMessage += `\nYou can also provide an API key for your discord account by sending the command to me as a DM.`;
        }
        errorMessage += '\nYou can find your API keys at https://beta.openai.com/account/api-keys.';
    }
    errorMessage += `\nYou can alternatively join the bot's server to chat.`;
    errorMessage += '\n]]';
    return errorMessage;
}
exports.getMissingAPIKeyErrorMessage = getMissingAPIKeyErrorMessage;
//# sourceMappingURL=GetMissingAPIKeyErrorMessage.js.map