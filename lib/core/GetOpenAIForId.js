"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOpenAIForId = exports.OpenAICache = void 0;
const openai_1 = require("openai");
const GetEnv_1 = require("../utils/GetEnv");
const config_1 = require("./config");
const MainServerId_1 = require("./MainServerId");
exports.OpenAICache = {};
const USE_SAME_API_KEY_FOR_ALL = (0, GetEnv_1.getEnv)('USE_SAME_API_KEY_FOR_ALL');
async function getOpenAIForId(id) {
    if (USE_SAME_API_KEY_FOR_ALL === 'true' && id !== MainServerId_1.mainServerId) {
        return getOpenAIForId(MainServerId_1.mainServerId);
    }
    if (exports.OpenAICache[id] === undefined) {
        const config = await (0, config_1.getConfigForId)(id);
        const openAIApiKey = config.openAIApiKey;
        if (openAIApiKey) {
            exports.OpenAICache[id] = new openai_1.OpenAIApi(new openai_1.Configuration({
                apiKey: openAIApiKey,
            }));
        }
    }
    return exports.OpenAICache[id];
}
exports.getOpenAIForId = getOpenAIForId;
//# sourceMappingURL=GetOpenAIForId.js.map