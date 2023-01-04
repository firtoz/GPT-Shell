"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getNowPlusOneMonth = exports.getMessageCountForUser = void 0;
function getMessageCountForUser(messageCounter, userId) {
    const messageCountInfo = messageCounter[userId] = Object.assign({
        count: 0,
        limitCount: 0,
        imageCount: 0,
        imageLimitCount: 0,
        warned: false,
        nextReset: getNowPlusOneMonth(),
    }, messageCounter[userId] ?? {});
    for (const key of ['limitCount', 'count', 'imageLimitCount', 'imageCount']) {
        const value = messageCountInfo[key];
        if (value === undefined || isNaN(value)) {
            messageCountInfo[key] = 0;
        }
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