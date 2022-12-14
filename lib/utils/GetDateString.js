"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDateString = void 0;
function getDateString(date) {
    const dayOfWeek = date.toLocaleString('default', { weekday: 'short' });
    const dayOfMonth = date.toLocaleString('default', { day: 'numeric' });
    const month = date.toLocaleString('default', { month: 'numeric' });
    const year = date.toLocaleString('default', { year: 'numeric' });
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${dayOfWeek} ${dayOfMonth}|${month}|${year} ${hours};${minutes};${seconds}`;
}
exports.getDateString = getDateString;
//# sourceMappingURL=GetDateString.js.map