import { Client } from "discord.js";
export declare const discordClient: Client<boolean>;
export declare const getGuildName: (guildId: string | null) => Promise<string>;
