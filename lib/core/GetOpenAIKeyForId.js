"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOpenAIKeyForId = exports.OpenAICache = void 0;
const openai_1 = require("openai");
const db_1 = require("../database/db");
exports.OpenAICache = {};
async function getOpenAIKeyForId(id) {
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