import {ChannelType, Client, Events} from "discord.js";
import {Commands} from "../Commands";
import {StartListeningToMessages} from "./ready/message-handling/startListeningToMessages";
import {InitializeThreads} from "./ready/initializeThreads";
import {logMessage} from "../../utils/logMessage";
import {db} from "../../database/db";
import {getEnv} from "../../utils/GetEnv";
import {ConfigType, getConfig, getConfigForId, ConfigForIdType} from "../../core/config";
import {mainServerId} from "../../core/MainServerId";
import {getOpenAIForId} from "../../core/GetOpenAIForId";
import {getPineconeClient} from "../../core/pinecone";


async function checkUsage(config: ConfigForIdType) {
    try {
        const usage = await fetch("https://api.openai.com/v1/usage?date=2022-12-26", {
            "credentials": "include",
            "headers": {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:108.0) Gecko/20100101 Firefox/108.0",
                "Accept": "*/*",
                "Accept-Language": "en-GB",
                "Sec-Fetch-Dest": "empty",
                "Sec-Fetch-Mode": "no-cors",
                "Sec-Fetch-Site": "same-site",
                "Authorization": `Bearer ${config.openAIApiKey}`,
                "Pragma": "no-cache",
                "Cache-Control": "no-cache"
            },
            "referrer": "https://beta.openai.com/",
            "method": "GET",
            "mode": "cors"
        });

        const subscription = await fetch("https://api.openai.com/dashboard/billing/subscription", {
            "credentials": "include",
            "headers": {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:108.0) Gecko/20100101 Firefox/108.0",
                "Accept": "*/*",
                "Accept-Language": "en-GB",
                "Authorization": `Bearer ${config.openAIApiKey}`,
                "Sec-Fetch-Dest": "empty",
                "Sec-Fetch-Mode": "cors",
                "Sec-Fetch-Site": "same-site"
            },
            "referrer": "https://beta.openai.com/",
            "method": "GET",
            "mode": "cors"
        });

        if (usage != null) {
            const json = await usage.json();

            logMessage(`Usage fetch`, json);
        }

        if (subscription != null) {
            const json = await subscription.json();

            logMessage(`Sub fetch`, json);
        }
    } catch (e) {
        logMessage(`Usage fetch fail`, e);
    }
}

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
        await getConfigForId(mainServerId);

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

        // await checkUsage(config);

        await getPineconeClient();

        StartListeningToMessages(client);
        InitializeThreads();
    });
};
