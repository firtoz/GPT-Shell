import {getEnv} from "../utils/GetEnv";

export const MAIN_SERVER_ID = getEnv('MAIN_SERVER_ID');

if (!MAIN_SERVER_ID) {
    throw new Error('Need MAIN_SERVER_ID env variable.');
}

export const mainServerId = MAIN_SERVER_ID;
