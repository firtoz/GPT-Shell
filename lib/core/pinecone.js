"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.trySavingPineconeOptions = exports.getPineconeClient = void 0;
const pinecone_client_1 = require("pinecone-client");
const logMessage_1 = require("../utils/logMessage");
const config_1 = require("./config");
/**
 * If undefined, then need to find it.
 *
 * If null, the not set.
 */
let pineconeClientCache;
const getPineconeClient = async () => {
    if (pineconeClientCache !== undefined) {
        return pineconeClientCache;
    }
    const config = await (0, config_1.getConfig)();
    const pineconeOptions = config.pineconeOptions;
    if (pineconeOptions) {
        const testClient = new pinecone_client_1.PineconeClient(pineconeOptions);
        try {
            await testClient.describeIndexStats();
            pineconeClientCache = testClient;
            (0, logMessage_1.logMessage)('Successfully created pinecone client!');
        }
        catch (e) {
            (0, logMessage_1.logMessage)('Cannot create pinecone client...', e);
            pineconeClientCache = null;
        }
    }
    else {
        pineconeClientCache = null;
    }
    return pineconeClientCache;
};
exports.getPineconeClient = getPineconeClient;
const trySavingPineconeOptions = async (options) => {
    if (options === null) {
        // then remove the association
        pineconeClientCache = null;
        const config = await (0, config_1.getConfig)();
        config.pineconeOptions = null;
        await (0, config_1.setConfig)(config);
        return {
            success: true,
        };
    }
    const testClient = new pinecone_client_1.PineconeClient(options);
    try {
        await testClient.describeIndexStats();
        pineconeClientCache = testClient;
        const config = await (0, config_1.getConfig)();
        config.pineconeOptions = options;
        await (0, config_1.setConfig)(config);
        (0, logMessage_1.logMessage)('Successfully created pinecone client!');
        return {
            success: true,
        };
    }
    catch (e) {
        (0, logMessage_1.logMessage)('Cannot create pinecone client...', e);
        return {
            success: false,
            message: e.message,
        };
    }
};
exports.trySavingPineconeOptions = trySavingPineconeOptions;
//# sourceMappingURL=pinecone.js.map