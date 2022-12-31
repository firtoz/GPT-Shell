"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNowPlusOneMonth = exports.getMessageCountForUser = void 0;
function getMessageCountForUser(messageCounter, userId) {
    const messageCountInfo = messageCounter[userId] ?? {
        count: 0,
        limitCount: 0,
        warned: false,
        nextReset: getNowPlusOneMonth(),
    };
    if (isNaN(messageCountInfo.limitCount)) {
        messageCountInfo.limitCount = 0;
    }
    if (isNaN(messageCountInfo.count)) {
        messageCountInfo.count = 0;
    }
    return messageCountInfo;
}
exports.getMessageCountForUser = getMessageCountForUser;
function getNowPlusOneMonth() {
    let date = new Date();
    date.setMonth(date.getMonth() + 1);
    return date.getTime();
}
exports.getNowPlusOneMonth = getNowPlusOneMonth;
//# sourceMappingURL=GetMessageCountForUser.js.map