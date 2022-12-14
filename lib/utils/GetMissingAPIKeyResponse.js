"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMissingAPIKeyResponse = void 0;
const GetMissingAPIKeyErrorMessage_1 = require("./GetMissingAPIKeyErrorMessage");
async function getMissingAPIKeyResponse(isDM) {
    const response = {
        content: await (0, GetMissingAPIKeyErrorMessage_1.getMissingAPIKeyErrorMessage)(isDM),
    };
    return response;
}
exports.getMissingAPIKeyResponse = getMissingAPIKeyResponse;
//# sourceMappingURL=GetMissingAPIKeyResponse.js.map