import { CommandInteraction, ChatInputApplicationCommandData, Client, ContextMenuCommandInteraction } from "discord.js";
export interface Command extends ChatInputApplicationCommandData {
    ephemeral?: boolean;
    run: (client: Client, interaction: CommandInteraction | ContextMenuCommandInteraction) => void;
}
