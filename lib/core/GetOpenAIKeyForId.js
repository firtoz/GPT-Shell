"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOpenAIKeyForId = exports.OpenAICache = void 0;
const openai_1 = require("openai");
const db_1 = require("../database/db");
const GetEnv_1 = require("../utils/GetEnv");
exports.OpenAICache = {};
const OPENAI_API_KEY = (0, GetEnv_1.getEnv)('OPENAI_API_KEY');
const MAIN_SERVER_ID = (0, GetEnv_1.getEnv)('MAIN_SERVER_ID');
if (!OPENAI_API_KEY) {
    throw new Error('Need OPENAI_API_KEY env variable.');
}
if (!MAIN_SERVER_ID) {
    throw new Error('Need MAIN_SERVER_ID env variable.');
}
const USE_SAME_API_KEY_FOR_ALL = (0, GetEnv_1.getEnv)('USE_SAME_API_KEY_FOR_ALL');
exports.OpenAICache[MAIN_SERVER_ID] = new openai_1.OpenAIApi(new openai_1.Configuration({
    apiKey: OPENAI_API_KEY,
}));
async function getOpenAIKeyForId(id) {
    if (USE_SAME_API_KEY_FOR_ALL === 'true') {
        return exports.OpenAICache[MAIN_SERVER_ID];
    }
    if (exports.OpenAICache[id] === undefined) {
        const apiKey = await db_1.db.get(`CONFIG-API-KEY-${id}`);
        if (apiKey !== null) {
            exports.OpenAICache[id] = new openai_1.OpenAIApi(new openai_1.Configuration({
                apiKey: apiKey,
            }));
        }
    }
    return exports.OpenAICache[id];
}
exports.getOpenAIKeyForId = getOpenAIKeyForId;
//# sourceMappingURL=GetOpenAIKeyForId.js.map