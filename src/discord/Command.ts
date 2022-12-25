import {
    CommandInteraction,
    ChatInputApplicationCommandData,
    Client,
    ContextMenuCommandInteraction,
    ButtonInteraction
} from "discord.js";

export interface Command extends ChatInputApplicationCommandData {
    ephemeral?: boolean;
    run: (client: Client, interaction: CommandInteraction | ContextMenuCommandInteraction) => void;
}


export interface ButtonCommand {
    id: string,
    run: (client: Client, interaction: ButtonInteraction) => Promise<void>;
}
