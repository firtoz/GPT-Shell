import {ChannelType, Client, Events} from "discord.js";
import {Commands} from "../Commands";
import {StartListeningToMessages} from "./ready/message-handling/startListeningToMessages";
import {InitializeThreads} from "./ready/initializeThreads";
import {logMessage} from "../../utils/logMessage";
import {db} from "../../database/db";
import {getEnv} from "../../utils/GetEnv";
import {getConfig} from "../../core/config";
import {mainServerId} from "../../core/MainServerId";
import {getOpenAIForId} from "../../core/GetOpenAIForId";

const MAIN_SERVER_ID = getEnv('MAIN_SERVER_ID');

export default (client: Client): void => {
    client.on(Events.ClientReady, async () => {
        if (!client.user || !client.application) {
            return;
        }

        console.log("Initialising db...");

        if (!await db.initialise()) {
            throw new Error('failed to initialise...');
        }

        console.log("Connected to db.");

        await client.application.commands.set(Commands);

        console.log(`${client.user.username} is online`);
        logMessage('Started!');

        const guilds = await client.guilds.fetch();

        logMessage(`Currently in ${guilds.size} guild${guilds.size !== 1 ? 's' : ''}.`);

        await getConfig();

        let openaiSuccess = false;

        const openai = await getOpenAIForId(mainServerId);
        if (openai) {
            try {
                const models = await openai.listModels();

                if (models) {
                    openaiSuccess = true;
                }
            } catch (e) {
                logMessage('Cannot use openai:', e);
            }
        }

        logMessage(`Openai connection: ${openaiSuccess ? 'good' : 'bad'}!`);

        StartListeningToMessages(client);
        InitializeThreads();
    });
};
