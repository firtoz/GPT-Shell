# GPT-Shell

GPT-Shell is an OpenAI based chat-bot that is similar to OpenAI's ChatGPT (https://chat.openai.com/).

It allows users to converse with a virtual companion. It uses nodejs and typescript, as well as modern yarn,
to create a seamless conversation experience.

https://user-images.githubusercontent.com/108406948/207628213-c8bebc1b-ce72-45ba-907f-e0d6f51c27cd.mp4


## Try it out

You can try the bot on the official Discord server:

[![](https://dcbadge.vercel.app/api/server/TruuVEBmcC)](https://discord.gg/TruuVEBmcC)

## Usage

Set up a discord bot and add it to your server.

Follow the setup instructions below.

To interact with GPT-Shell, users can:
- Use the `/chat-gpt` command to start a conversation with the bot
- Ping the bot in a channel it's in
- Message the bot directly

The `/chat-gpt` command will start a new conversation thread, and whenever the user types something,
the bot will respond.

The bot is able to handle multiple conversations at once,
so you can start as many conversations as you like.

## Setup

### Prerequisites:
Nodejs: https://nodejs.org/en/ (18 or above)
Yarn: https://nodejs.org/en/ (after installing nodejs)

To use GPT-Shell, you will need to:
- Clone the project
- Open the terminal in the project's folder 
  - (in windows, right click somewhere in the folder and select "Open In Terminal")
  - if you see something about powershell, type `cmd` and hit enter, to go to the simpler command line terminal.
- Run `yarn install`

You can also fork the replit:

https://replit.com/@Ephemeros/GPT-Shell

Set up the environment variables as described below.

Then to start a development environment, run `yarn dev`. To build and run, run `yarn build` and then `yarn start`.

Go to your server, and type the config command, and set the API key for your server using the config.

```
/chat-gpt-config
```

![config-api-key.png](config-api-key.png)


## Environment Variables

The following environment variables are required for GPT-Shell to work properly.

MongoDB:
- MONGODB_URI: The MongoDB connection string.
  - Should look something like this: mongodb+srv://<username>:<password><cluster>.<something>.mongodb.net/?retryWrites=true&w=majority
- DB_NAME: The name of the collection in MongoDB. You can use `CHAT_DB` or anything you like.

Bot Token:
- BOT_TOKEN: The Discord bot token
  - You can get it by following https://discord.com/developers/applications then selecting your app and then selecting
    "Bot".

Commands:
- COMMAND_NAME: The name of the chat-gpt command
- CONFIG_COMMAND_NAME: The name of the config command (if you want users to be able to configure their bot setup)

Discord Server Details:
- MAIN_SERVER_ID: The Discord server where the bot lives
- LOG_CHANNEL_ID: (Optional) The channel for log messages
- MAIN_SERVER_INVITE: (Optional) The ideally non-expiring server invite link (if you want users to add the bot to their
  server)
- USE_SAME_API_KEY_FOR_ALL: (Optional) When set to 'true', it will allow any server or user to use the bot without needing to provide their own API keys.

You can set the environment variables in any way you like, or place an .env.local file at the root of your project,
next to `package.json`, that looks like this:

```
# MongoDB:
MONGODB_URI=
DB_NAME=

# Bot Token:
BOT_TOKEN=

# Commands:
COMMAND_NAME=chat-gpt
CONFIG_COMMAND_NAME=chat-gpt-config
CUSTOM_PROMPT_COMMAND_NAME=chat-gpt-prompt

# Discord Server Details:
MAIN_SERVER_ID=
LOG_CHANNEL_ID=
MAIN_SERVER_INVITE=
USE_SAME_API_KEY_FOR_ALL=
```


## Long-Term Memory
Starting from 2.0.0, the bot has the capacity to have a long-term memory.

This functionality is experimental, but internal testing shows that it works quite well for typical conversation.

Does not work so well if the conversation has long pieces of code, because of token limitations.

How it works:
- the bot creates [embeddings](https://openai.com/blog/new-and-improved-embedding-model/) for every message in the conversation
- if the conversation is short, all the conversation history is included in the prompt
- if the conversation is long enough, when a new message is sent, that message's embedding is compared to the conversation history, and only the most relevant messages will be included in the prompt.

To be able to set this up, use the config command on the main server:

```
/chat-gpt-config
```

![config.png](config.png)

Then enter the pinecone configuration details.

If you did it correctly, you should see something like this:

![config-set.png](config-set.png)

## Custom Prompts
By default, the bot behaves like a helpful social engineer.

If you want the bot to behave differently, you can use a custom prompt.

This can be done in a new channel dedicated to the bot, or a new conversation thread, or in DMs.

> Warning: defining a custom prompt will erase the chat history!




## Contributions

We welcome contributions to GPT-Shell. If you have an idea for a new feature or have found a bug,
please open an issue on GitHub. We would also appreciate any sponsorships or donations.

You can sponsor us through our GitHub sponsor page [here](https://github.com/sponsors/firtoz).

## License

GPT-Shell is released under the MIT License.
