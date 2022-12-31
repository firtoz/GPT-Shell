import {MessageCounter} from "./config";

export function getMessageCountForUser(messageCounter: MessageCounter, userId: string) {
    return messageCounter[userId] ?? {
        count: 0,
        limitCount: 0,
        warned: false,
        nextReset: getNowPlusOneMonth(),
    };
}

export function getNowPlusOneMonth(): number {
    let date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date.getTime();
}
