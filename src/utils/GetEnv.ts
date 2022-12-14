import path from "path";
import dotenv from "dotenv";

dotenv.config({
    // language=file-reference
    path: path.join(__dirname, '../../.env.local'),
});

export const getEnv = (key: string) => {
    return process.env[key] ?? null;
}
