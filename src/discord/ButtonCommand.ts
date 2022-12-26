import {ButtonInteraction, Client} from "discord.js";

export interface ButtonCommand {
    id: string,
    run: (client: Client, interaction: ButtonInteraction) => Promise<void>;
}
