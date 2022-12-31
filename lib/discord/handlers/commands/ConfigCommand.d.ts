import { Command } from "../../Command";
import { BaseInteraction } from "discord.js";
export declare function getConfigIdForInteraction(commandInteraction: BaseInteraction): Promise<{
    configId: string | null;
    isDM: boolean;
}>;
export declare const ConfigCommand: Command;
