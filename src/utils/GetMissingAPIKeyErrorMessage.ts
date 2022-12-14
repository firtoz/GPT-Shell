import {getEnv} from "./GetEnv";

const API_KEY_COMMAND_NAME = getEnv('API_KEY_COMMAND_NAME');

export async function getMissingAPIKeyErrorMessage(isDM: boolean) {
    let errorMessage = `[[
Could not find OpenAI API Key for this ${isDM ? 'user' : 'server'}.`;

    if (API_KEY_COMMAND_NAME) {
        if (isDM) {
            errorMessage += `\nPlease provide an OpenAI API key using \`/${API_KEY_COMMAND_NAME} [OPENAI_API_KEY]\` to continue.`;
        } else {
            errorMessage += `\nPlease ask an administrator to provide an OpenAI API key using \`/${API_KEY_COMMAND_NAME} [OPENAI_API_KEY]\` to continue.`;
            errorMessage += `\nYou can also provide an API key for your discord account by sending the command to me as a DM.`;
        }
        errorMessage += '\nYou can find your API keys at https://beta.openai.com/account/api-keys.';
    }

    errorMessage += `\nYou can alternatively join the bot's server to chat.`;

    errorMessage += '\n]]'

    return errorMessage;
}
