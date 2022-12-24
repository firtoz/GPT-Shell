"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encodeLength = void 0;
const gpt3_tokenizer_1 = __importDefault(require("gpt3-tokenizer"));
const encoder = new gpt3_tokenizer_1.default({
    type: 'gpt3',
});
const encodeLength = (input) => {
    try {
        return encoder.encode(input).bpe.length;
    }
    catch (e) {
        return Math.floor((input ?? '').split(' ').length * 1.20);
    }
};
exports.encodeLength = encodeLength;
//# sourceMappingURL=EncodeLength.js.map