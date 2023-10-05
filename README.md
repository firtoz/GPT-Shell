# mochiGPT

| :exclamation:  This is a work in progress :exclamation: |
|--------------------------------------------------------------------------------------------------------------------------------------------------|

mochiGPT is an OpenAI based chat-bot that is similar to OpenAI's [ChatGPT](https://chat.openai.com/).

It allows users to converse with a virtual companion. It uses `nodejs` and `typescript`.
to create a seamless conversation experience.

It can also generate images based on your conversation!

https://user-images.githubusercontent.com/108406948/210852737-c1a30a08-ed0d-4cb9-9fd2-9b5376ba4233.mp4

## Try it out

You can try the bot on the official Discord server:

[![](https://dcbadge.vercel.app/api/server/Dwnf3vQSz4)](https://discord.gg/Dwnf3vQSz4)

## Usage

To interact with mochiGPT, users can:
- Use the `/mochi-gpt` command to start a conversation with the bot
- Ping the bot in a channel it's in
- Message the bot directly

The `/mochi-gpt` command will start a new conversation thread, and whenever the user types something,
the bot will respond.

The bot is able to handle multiple conversations at once,
so you can start as many conversations as you like.

## Bot Setup
Set up a discord bot [here](https://discord.com/developers/applications/) and add it to your server.

Scopes:
- bot
- application.commands

Bot Permissions:
- read messages/view channels
- send messages
- create public threads
- create private threads
- send messages in threads
- embed links
- attach files
- use slash commands

You also need to enable the Message Content Intent:

<details>
<summary>Expand to see image</summary>

![image](https://user-images.githubusercontent.com/108406948/210853245-31728f5a-3017-4a26-9caa-0541b6fe1aae.png)

</details>

## Setup

- You can see the [Replit installation guide here](./replit.md)

- Or you can set it up on your machine.

### Prerequisites:

- [Nodejs](https://nodejs.org/en/): (18 or above)

- [pm2](https://pm2.io/docs/runtime/guide/installation/): To keep your bot alive even after killing your terminal.

PM2: https://pm2.io/docs/runtime/guide/installation/ (If you are want your bot to run 24/7)

To use mochiGPT, you will need to:
- Clone the project:
```
git clone https://github.com/vikkshan/mochiGPT.git
```
- Open the terminal in the project's folder:
```
cd mochiGPT
```
(in windows, right click somewhere in the folder and select "Open In Terminal")
if you see something about powershell, type `cmd` and hit enter, to go to the simpler command line terminal.
- Install dependancies:
```
npm install
```
- Set up environment variables

## Setting up Environment Variables

The following environment variables are required for mochiGPT to work properly.

You can set the environment variables in any way you like, or place an .env.local file at the root of your project (rename `example.env.local` to `.env.local`),
Ensure that your `.env.local` looks like this:
<details>
  <summary> [EXPAND] Click to see .env.local</summary>
  
```md
# MongoDB:
MONGODB_URI=
DB_NAME=mochiGPT

# Bot Token from Discord:
BOT_TOKEN=

# Commands:
COMMAND_NAME=mochi-gpt
PRIVATE_COMMAND_NAME=mochi-private
CONFIG_COMMAND_NAME=mochi-config
CUSTOM_PROMPT_COMMAND_NAME=mochi-prompt
DRAW_COMMAND_NAME=mochi-draw

# Discord Server Details:
MAIN_SERVER_ID=
LOG_CHANNEL_ID=
MAIN_SERVER_INVITE=
ADMIN_PING_ID=
USE_SAME_API_KEY_FOR_ALL=false
IGNORE_INIT=false
```
</details>


MongoDB:
- MONGODB_URI: The MongoDB connection string.
  - Should look something like this: mongodb+srv://<username>:<password><cluster>.<something>.mongodb.net/?retryWrites=true&w=majority
- DB_NAME: The name of the collection in MongoDB. You can use `CHAT_DB` or anything you like.

Bot Token:
- BOT_TOKEN: The Discord bot token
  - You can get it from your [Discord Dev Portal](https://discord.com/developers/applications) by selecting your app and then selecting "Bot".

Commands:
- COMMAND_NAME: The main command for chat initialisation.
- PRIVATE_COMMAND_NAME: Command to create private threads.
- CONFIG_COMMAND_NAME: The name of the config command
- CUSTOM_PROMPT_COMMAND_NAME: (Optional) The name of the command for custom prompts
- DRAW_COMMAND_NAME: (Optional) The name of the draw command.

Discord Server Details:
- MAIN_SERVER_ID: The Discord server where the bot lives
- LOG_CHANNEL_ID: (Optional) The channel for log messages
- MAIN_SERVER_INVITE: (Optional) The ideally non-expiring server invite link (if you want users to add the bot to their
  server)
- USE_SAME_API_KEY_FOR_ALL: (Optional) When set to 'true', it will allow any server or user to use the bot without needing to provide their own API keys.
- ADMIN_PING_ID: Bot owner's Discord id (that's you!)
  
  Used to let you send some special commands and configure the bot.
- IGNORE_INIT: (Optional) When set to 'true', when it starts, will not check active threads for new messages
  since the bot was last online.
  If you're in many servers, there may be many active threads, so that would hit a rate limit. In that case, it's better
  to handle messages as they come, instead of checking many threads at once.

Extras:
- WOLFRAM_APP_ID: Used for the Wolfram Alpha ability.

  Can create an app at [WolframAlpha Dev Portal](https://developer.wolframalpha.com/portal/myapps) and get its id.

## Start your bot
Set up the environment variables as described above.
- Install pm2:

With npm:

```
npm install pm2 -g
```
With yarn:

```
yarn global add pm2
```
With debian, use the install script:

```
apt update && apt install sudo curl && curl -sL https://raw.githubusercontent.com/Unitech/pm2/master/packager/setup.deb.sh | sudo -E bash -
```
- Then to start a development environment, run 
```
npm run dev
```
This way, whenever you change the code, it will restart the bot to update.

- To build and start the bot, run 
```
npm run build
``` 
and then 
```
npm start
```
>You can also run `npm run start` to start the bot.

- NOTE: running `npm start` or `npm run start` will start the bot with PM2 and give it the name "mochiGPT". You can replace "mochiGPT" with a name of your choice in [package.json](./package.json). It will also show logs for the PM2 running processes and save them.
>NOTE: If you get the error:
```js
[PM2][ERROR] Script already launched, add -f option to force re-execution
```
>It means that the bot is already running. You can delete it by running the following command followed by the command to start the bot, i.e. `npm run start`:
```
pm2 delete mochiGPT
```
> Or simply restart it by running:
```
pm2 restart mochiGPT
```

- If you are in dev environment, use `node .` or `npm run dev` to test your code:
```
node .
```
Once you are satisfied with the changes run:
```
pm2 restart mochiGPT && pm2 logs
```
You can also restart it from the [pm2.io dashboard](https://pm2.io/) as shown bellow:
<details>
<summary>Expand to see image</summary>

![image](https://cdn.discordapp.com/attachments/1072834906742345808/1076183450417123358/image.png)

</details>

## Configuration

Go to your server, and type the config command, and set the API key for your server using the config.

```
/mochi-config
```

<details>
<summary>Expand to see config image</summary>

![config-api-key.png](config-api-key.png)

</details>



## Long-Term Memory

Starting from 2.0.0, the bot has the capacity to have a long-term memory.

<details>

<summary> Expand to see how to configure long term memory. </summary>

This functionality is experimental, but internal testing shows that it works quite well for typical conversation.

Does not work so well if the conversation has long pieces of code, because of token limitations.

How it works:
- the bot creates [embeddings](https://openai.com/blog/new-and-improved-embedding-model/) for every message in the conversation
- if the conversation is short, all the conversation history is included in the prompt
- if the conversation is long enough, when a new message is sent, that message's embedding is compared to the conversation history, and only the most relevant messages will be included in the prompt.

To be able to set this up, use the config command on the main server:

```
/mochi-config
```

![config.png](config.png)

Then enter the pinecone configuration details.

You can create an account at https://app.pinecone.io/.

If you did it correctly, you should see something like this:

![config-set.png](config-set.png)

</details>


## Custom Prompts
By default, the bot behaves like a helpful software engineer.

If you want the bot to behave differently, you can use a custom prompt.

This can be done in a new channel dedicated to the bot, or a new conversation thread, or in DMs.

You can use the `/mochi-prompt` command, if you have the permissions, and you can set the custom prompt
for the bot by filling the form.

This command can be used in:
- channels (if you are a server admin)
- threads (if you are the one who created the thread)
- DMs

The temperature is the same as OpenAI's temperature parameter. 0 means it becoems repetitive, 1 means it becomes a bit chaotic.
Default is 0.8 for mochiGPT.

![custom-prompt.png](custom-prompt.png)


## Contributions

We welcome contributions to mochiGPT. If you have an idea for a new feature or have found a bug,
please open an issue on GitHub. We would also appreciate any sponsorships or donations.

You can sponsor us through our GitHub sponsor page [here](https://github.com/sponsors/vikkshan).

## License

mochiGPT is based on GPT-Shell[GPT-Shell](https://github.com/firtoz/GPT-Shell), released under the MIT License.