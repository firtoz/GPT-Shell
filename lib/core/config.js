"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.setConfigForId = exports.getConfigForId = exports.saveMessageCounter = exports.getMessageCounter = exports.setConfig = exports.getConfig = exports.getDefaultModerationThresholds = void 0;
const db_1 = require("../database/db");
const lodash_1 = __importDefault(require("lodash"));
const GetMessageCountForUser_1 = require("./GetMessageCountForUser");
function getDefaultModerationThresholds() {
    return {
        "hate": 1,
        "self-harm": 1,
        "hate/threatening": 1,
        "sexual/minors": 0.6,
        "violence/graphic": 1,
        "sexual": 0.6,
        "violence": 1,
    };
}
exports.getDefaultModerationThresholds = getDefaultModerationThresholds;
const defaultConfig = {
    pineconeOptions: null,
    maxMessagesToEmbed: 300,
    promptPermissions: [],
    moderationThreshold: getDefaultModerationThresholds()
};
const getConfigInternal = async () => {
    const defaultClone = lodash_1.default.cloneDeep(defaultConfig);
    const configFromDB = await db_1.db.get('BOT-CONFIG');
    if (configFromDB) {
        return Object.assign(defaultClone, configFromDB);
    }
    return defaultClone;
};
let configState = null;
const getConfig = async () => {
    if (configState === null) {
        configState = await getConfigInternal();
    }
    return configState;
};
exports.getConfig = getConfig;
const setConfig = async (value) => {
    configState = value;
    return await db_1.db.set('BOT-CONFIG', value);
};
exports.setConfig = setConfig;
const defaultConfigForId = {
    maxTokensForRecentMessages: 1000,
    modelInfo: {
        ['text-davinci-003']: {
            MAX_ALLOWED_TOKENS: 2000,
            MAX_TOKENS_PER_RESPONSE: 512,
        },
    },
    openAIApiKey: null,
    useKeyInServersToo: false,
    maxMessagePerUser: -1,
    exceptionRoleIds: [],
    chatChannelIds: [],
    maxImagePerUser: 5,
    messageExpiredNote: '',
};
const serverConfigState = {};
const messageCounterCache = {};
const getMessageCounter = async (id) => {
    if (messageCounterCache[id] === undefined) {
        const counter = await db_1.db.get(`MESSAGE-COUNTER-${id}`);
        if (counter) {
            for (let value of Object.values(counter)) {
                if (value) {
                    if (!value.nextReset) {
                        value.nextReset = (0, GetMessageCountForUser_1.getNowPlusOneMonth)();
                    }
                }
            }
        }
        messageCounterCache[id] = counter ?? {};
    }
    return messageCounterCache[id];
};
exports.getMessageCounter = getMessageCounter;
const saveMessageCounter = async (id, counter) => {
    messageCounterCache[id] = counter;
    await db_1.db.set(`MESSAGE-COUNTER-${id}`, counter);
};
exports.saveMessageCounter = saveMessageCounter;
const getConfigForIdInternal = async (id) => {
    const defaultClone = lodash_1.default.cloneDeep(defaultConfigForId);
    defaultClone.openAIApiKey = await db_1.db.get(`CONFIG-API-KEY-${id}`);
    const configFromDB = await db_1.db.get(`BOT-CONFIG-FOR-${id}`);
    if (configFromDB) {
        return Object.assign(defaultClone, configFromDB);
    }
    await (0, exports.setConfigForId)(id, defaultClone);
    return defaultClone;
};
const getConfigForId = async (id) => {
    if (serverConfigState[id] == undefined) {
        serverConfigState[id] = await getConfigForIdInternal(id);
    }
    return serverConfigState[id];
};
exports.getConfigForId = getConfigForId;
const setConfigForId = async (id, value) => {
    serverConfigState[id] = value;
    return await db_1.db.set(`BOT-CONFIG-FOR-${id}`, value);
};
exports.setConfigForId = setConfigForId;
//# sourceMappingURL=config.js.map