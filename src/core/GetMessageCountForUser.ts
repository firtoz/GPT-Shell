import {MessageCounter} from "./config";

export function getMessageCountForUser(messageCounter: MessageCounter, userId: string) {
    const messageCountInfo = messageCounter[userId] ?? {
        count: 0,
        limitCount: 0,
        warned: false,
        nextReset: getNowPlusOneMonth(),
    };
    if(isNaN(messageCountInfo.limitCount)) {
        messageCountInfo.limitCount = 0;
    }
    if(isNaN(messageCountInfo.count)) {
        messageCountInfo.count = 0;
    }
    return messageCountInfo;
}

export function getNowPlusOneMonth(): number {
    let date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date.getTime();
}
