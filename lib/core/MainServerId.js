"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mainServerId = exports.MAIN_SERVER_ID = void 0;
const GetEnv_1 = require("../utils/GetEnv");
exports.MAIN_SERVER_ID = (0, GetEnv_1.getEnv)('MAIN_SERVER_ID');
if (!exports.MAIN_SERVER_ID) {
    throw new Error('Need MAIN_SERVER_ID env variable.');
}
exports.mainServerId = exports.MAIN_SERVER_ID;
//# sourceMappingURL=MainServerId.js.map