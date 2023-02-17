"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.extractWolframDescriptions = exports.WolframHandler = void 0;
const discord_js_1 = require("discord.js");
const axios_1 = __importDefault(require("axios"));
const uuid_1 = require("uuid");
const logMessage_1 = require("../utils/logMessage");
const discordClient_1 = require("../discord/discordClient");
const GetEnv_1 = require("../utils/GetEnv");
const WOLFRAM_APP_ID = (0, GetEnv_1.getEnv)('WOLFRAM_APP_ID');
async function getSplitImageData(url, maxHeight) {
    const axiosResponse = await (0, axios_1.default)({
        method: 'get',
        url,
        responseType: 'arraybuffer'
    });
    try {
        const { createCanvas, loadImage: canvasLoadImage } = await Promise.resolve().then(() => __importStar(require('canvas')));
        const image = await canvasLoadImage(Buffer.from(axiosResponse.data));
        const imageHeight = image.height;
        const canvas = createCanvas(image.width, imageHeight);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(image, 0, 0);
        const buffers = [];
        let currStart = 0;
        let finished = false;
        while (!finished) {
            let currEnd = currStart + maxHeight;
            if (currEnd >= imageHeight) {
                currEnd = imageHeight;
                finished = true;
            }
            const newCanvas = createCanvas(image.width, currEnd - currStart);
            newCanvas.getContext('2d').putImageData(ctx.getImageData(0, currStart, image.width, currEnd - currStart), 0, 0);
            buffers.push(newCanvas.toBuffer('image/png'));
            currStart = currEnd + 1;
        }
        return buffers;
    }
    catch (e) {
        return [Buffer.from(axiosResponse.data)];
    }
}
class WolframHandler {
    storage;
    subItems;
    constructor(storage) {
        this.storage = storage;
        this.subItems = storage.subItems;
    }
    static async handle(descriptions, userId, messageToReplyTo, isCommand = false) {
        let reaction = null;
        try {
            reaction = await messageToReplyTo.react('⏳');
        }
        catch (e) {
            // ignore
        }
        const bufferList = await Promise.all(descriptions.map(async (description) => {
            try {
                const url = `https://api.wolframalpha.com/v1/simple?i=${encodeURIComponent(description)}&appid=${WOLFRAM_APP_ID}&width=1024&fontsize=38&units=metric&layout=labelbar`;
                // http://api.wolframalpha.com/v2/query?appid=DEMO&input=population%20of%20france&output=json
                return {
                    success: true,
                    result: await getSplitImageData(url, 600),
                };
            }
            catch (e) {
                return {
                    success: false,
                    error: e,
                };
            }
        }));
        for (let descIndex = 0; descIndex < descriptions.length; descIndex++) {
            let description = descriptions[descIndex];
            const id = (0, uuid_1.v4)();
            try {
                const splitResponse = bufferList[descIndex];
                if (!splitResponse.success) {
                    throw splitResponse.error;
                }
                const buffers = splitResponse.result;
                const countPerImage = 5;
                for (let i = 0; i < buffers.length; i += countPerImage) {
                    const bufferSlice = buffers.slice(i, i + countPerImage);
                    const files = bufferSlice.map((buffer, j) => new discord_js_1.AttachmentBuilder(buffer, {
                        name: `${id}-${i + j}.png`,
                        description: `${description}-${i + j}`,
                    }));
                    if (i === 0) {
                        await messageToReplyTo.reply({
                            content: description,
                            files,
                        });
                    }
                    else {
                        await messageToReplyTo.channel.send({
                            files,
                        });
                    }
                }
            }
            catch (e) {
                const axiosError = e;
                (0, logMessage_1.logMessage)(axiosError);
                const data = axiosError.response?.data;
                const message = data ? new TextDecoder().decode(data) : 'Unknown error';
                const embeds = [
                    new discord_js_1.EmbedBuilder()
                        .setTitle('Wolfram Request')
                        .setDescription(`Failed to get image for description ${description}: ${message}`)
                        .setColor(0xff0000)
                ];
                try {
                    await messageToReplyTo.reply({
                        embeds,
                    });
                }
                catch (e) {
                    (0, logMessage_1.logMessage)('failed to send error', e, { embeds });
                }
            }
        }
        try {
            if (reaction) {
                await reaction.users.remove(discordClient_1.discordClient.user.id);
            }
        }
        catch (e) {
            // ignore
        }
    }
}
exports.WolframHandler = WolframHandler;
const extractWolframDescriptions = (text) => {
    const pattern = /\[\[\s*WOLFRAM\s*\|(.+?)\]\]/gi;
    const matches = text.match(pattern);
    if (!matches) {
        return [];
    }
    return matches.map((match) => match.replace(pattern, '$1').trim());
};
exports.extractWolframDescriptions = extractWolframDescriptions;
//# sourceMappingURL=WolframHandler.js.map