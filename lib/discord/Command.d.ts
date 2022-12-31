import { ChatInputApplicationCommandData, Client, CommandInteraction, ContextMenuCommandInteraction } from "discord.js";
export interface Command extends ChatInputApplicationCommandData {
    ephemeral?: boolean;
    deferred?: boolean;
    run: (client: Client, interaction: CommandInteraction | ContextMenuCommandInteraction) => void;
}
