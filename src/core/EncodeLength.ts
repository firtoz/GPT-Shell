import GPT3Tokenizer from 'gpt3-tokenizer';

const encoder = new GPT3Tokenizer({
    type: 'gpt3',
});

export const encodeLength = (input: string): number => {
    try {
        return encoder.encode(input).bpe.length;
    } catch (e) {
        return Math.floor((input ?? '').split(' ').length * 1.20);
    }
}
