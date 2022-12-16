export type ModelName = 'text-davinci-003' | 'text-curie-001'
export const ModelInfo = {
    ['text-davinci-003']: {
        MAX_ALLOWED_TOKENS: 3000,
        MAX_TOKENS_PER_RESPONSE: 512,
    },
    ['text-curie-001']: {
        MAX_ALLOWED_TOKENS: 1500,
        MAX_TOKENS_PER_RESPONSE: 256,
    }
}
