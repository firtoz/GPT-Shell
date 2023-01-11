import GPT3Tokenizer from 'gpt3-tokenizer';
import {logMessage} from "../utils/logMessage";

const encoder = new GPT3Tokenizer({
    type: 'gpt3',
});

let printedWarnings = 0;

export const encodeLength = (input: string): number => {
    try {
        return encoder.encode(input).bpe.length;
    } catch (e) {
        if (printedWarnings < 10) {
            printedWarnings++;
            logMessage(`Encoding error: input: 
\`\`\`js
const input = \`${input.replace('\`', '\\`')}\`;
\`\`\``, e);
        }
        return Math.floor((input ?? '').split(' ').length * 2.30);
    }
}
