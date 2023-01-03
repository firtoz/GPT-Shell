import {MessageCounter, MessageCountInfo} from "./config";

export function getMessageCountForUser(messageCounter: MessageCounter, userId: string) {
    const messageCountInfo: MessageCountInfo = messageCounter[userId] = Object.assign({
        count: 0,
        limitCount: 0,
        imageCount: 0,
        imageLimitCount: 0,
        warned: false,
        nextReset: getNowPlusOneMonth(),
    }, messageCounter[userId] ?? {});

    for (const key of ['limitCount', 'count', 'imageLimitCount', 'imageCount']) {
        const value = (messageCountInfo as any)[key];

        if (value === undefined || isNaN(value)) {
            (messageCountInfo as any)[key] = 0;
        }
    }

    return messageCountInfo;
}

export function getNowPlusOneMonth(): number {
    let date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date.getTime();
}
