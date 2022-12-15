import {Client, Events} from "discord.js";
import {logMessage} from "../../utils/logMessage";

export default (client: Client): void => {
    client.on(Events.GuildCreate, (guild) => {
        logMessage(`Joined [${guild.name}]! Total guilds: ${client.guilds.cache.size}.`);
    });
    client.on(Events.GuildDelete, (guild) => {
        logMessage(`Left [${guild.name}]! Total guilds: ${client.guilds.cache.size}.`);
    });
};
