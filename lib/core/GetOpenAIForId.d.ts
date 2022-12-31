import { OpenAIApi } from "openai";
export declare const OpenAICache: Record<string, OpenAIApi | undefined>;
export declare function getOpenAIForId(id: string): Promise<OpenAIApi | undefined>;
