import {it, expect, describe} from 'vitest';

import {getLastMessagesUntilMaxTokens} from "../src/core/GetLastMessagesUntilMaxTokens";

const testMessage = 'hello there this is a test messagehello there this is a test messagehello there this is a test' +
    ' messagehello there this is a test messagehello there this is a test messagehello there this is a test message' +
    'hello there this is a test messagehello there this is a test messagehello there this is a test messagehello' +
    ' there this is a test messagehello there this is a test messagehello there this is a test messagehello there this' +
    ' is a test messagehello there this is a test messagehello there this is a test messagehello there this is a test' +
    ' messagehello there this is a test messagehello there this is a test messagehello there this is a test' +
    ' messagehello there this is a test messagehello there this is a test messagehello there this is a test' +
    ' messagehello there this is a test messagehello there this is a test messagehello there this is a test' +
    ' messagehello there this is a test messagehello there this is a test messagehello there this is a test' +
    ' messagehello there this is a test messagehello there this is a test messagehello there this is a test' +
    ' messagehello there this is a test messagehello there this is a test messagehello there this is a test' +
    ' messagehello there this is a test messagehello there this is a test messagehello there this is a test' +
    ' messagehello there this is a test messagehello there this is a test messagehello there this is a test' +
    ' messagehello there this is a test messagehello there this is a test messagehello there this is a test' +
    ' messagehello there this is a test messagehello there this is a test messagehello there this is a test' +
    ' messagehello there this is a test messagehello there this is a test messagehello there this is a test' +
    ' messagehello there this is a test messagehello there this is a test messagehello there this is a test' +
    ' messagehello there this is a test messagehello there this is a test messagehello there this is a test' +
    ' messagehello there this is a test messagehello there this is a test messagehello there this is a test' +
    ' messagehello there this is a test messagehello there this is a test messagehello there this is a test' +
    ' messagehello there this is a test messagehello there this is a test messagehello there this is a test' +
    ' messagehello there this is a test messagehello there this is a test messagehello there this is a test' +
    ' messagehello there this is a test messagehello there this is a test messagehello there this is a test' +
    ' messagehello there this is a test messagehello there this is a test messagehello there this is a test' +
    ' messagehello there this is a test messagehello there this is a test messagehello there this is a test' +
    ' messagehello there this is a test messagehello there this is a test messagehello there this is a test' +
    ' messagehello there this is a test messagehello there this is a test messagehello there this is a test' +
    ' messagehello there this is a test messagehello there this is a test messagehello there this is a test' +
    ' messagehello there this is';

describe('getLastMessagesUntilMaxTokens', () => {
    it('should return messages that sum up to less than the expected number', () => {
        const bcd = getLastMessagesUntilMaxTokens([
            {content: testMessage, numTokens: 600, id: '', embedding: null, type: 'human', timestamp: 0, userId: '', username: '', fixedTokens: true}, // 2400
            {content: testMessage, numTokens: 600, id: '', embedding: null, type: 'human', timestamp: 0, userId: '', username: '', fixedTokens: true}, // 1800
            {content: testMessage, numTokens: 600, id: '', embedding: null, type: 'human', timestamp: 0, userId: '', username: '', fixedTokens: true}, // 1200
            {content: testMessage, numTokens: 600, id: '', embedding: null, type: 'human', timestamp: 0, userId: '', username: '', fixedTokens: true}, // 600
        ], 2000);
        expect(bcd).toHaveLength(3);
        expect(bcd.map(item => item.content).join('')).to.eq(testMessage + testMessage + testMessage);
    });
});
