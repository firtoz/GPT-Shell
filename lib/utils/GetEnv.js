"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnv = void 0;
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config({
    // language=file-reference
    path: path_1.default.join(__dirname, '../../.env.local'),
});
const getEnv = (key) => {
    return process.env[key] ?? null;
};
exports.getEnv = getEnv;
//# sourceMappingURL=GetEnv.js.map