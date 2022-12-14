import { OpenAIApi } from "openai";
export declare const OpenAICache: Record<string, OpenAIApi | undefined>;
export declare function getOpenAIKeyForId(id: string): Promise<OpenAIApi | undefined>;
