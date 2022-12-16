export type CompletionError = {
    error?: {
        message: string;
        type: string;
        param: string | null;
        code: string | null;
    }
};
