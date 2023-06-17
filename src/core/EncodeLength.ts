import GPT3Tokenizer from 'gpt3-tokenizer';
import {ChatCompletionRequestMessage} from "openai";
import {ChatModelName} from "@firtoz/openai-wrappers";

let encodeUsageCount = 0;
let encoder = new GPT3Tokenizer({
    type: 'gpt3',
});

export const ChatModelNames: ChatModelName[] = [
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-0301',
    'gpt-4',
    'gpt-4-32k',
];

export function numTokensFromMessages(messages: ChatCompletionRequestMessage[], model: ChatModelName = 'gpt-3.5-turbo') {
    if (ChatModelNames.includes(model)) {
        let numTokens = 0;
        for (const message of messages) {
            numTokens += 4; // every message follows <im_start>{role/name}\n{content}<im_end>\n
            if (message.name) {
                numTokens += encodeLength(message.name);
            } else {
                numTokens += encodeLength(message.role);
            }
            numTokens += encodeLength(message.content);
        }
        numTokens += 2; // every reply is primed with <im_start>assistant
        return numTokens;
    } else {
        throw new Error(`numTokensFromMessages() is not presently implemented for model ${model}.
See https://github.com/openai/openai-python/blob/main/chatml.md for information on how messages are converted to tokens.`);
    }
}

export const encodeLength = (input: string): number => {
    encodeUsageCount++;
    if (encodeUsageCount > 1000) {
        encodeUsageCount = 0;
        encoder = new GPT3Tokenizer({
            type: 'gpt3',
        });
    }

    try {
        return encoder.encode(input).bpe.length;
    } catch (e) {
        return Math.floor((input || '').split(' ').length * 2.30);
    }
}
