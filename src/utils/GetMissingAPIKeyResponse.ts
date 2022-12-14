import {getEnv} from "./GetEnv";
import {BaseMessageOptions, EmbedBuilder, EmbedType} from "discord.js";
import {getMissingAPIKeyErrorMessage} from "./GetMissingAPIKeyErrorMessage";

export async function getMissingAPIKeyResponse(isDM: boolean) {
    const response: BaseMessageOptions = {
        content: await getMissingAPIKeyErrorMessage(isDM),
    };
    return response;
}
