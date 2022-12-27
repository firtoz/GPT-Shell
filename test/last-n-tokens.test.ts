import {it, expect, describe} from 'vitest';

import {getLastMessagesUntilMaxTokens} from "../src/core/GetLastMessagesUntilMaxTokens";

describe('getLastMessagesUntilMaxTokens', () => {
    it('should return messages that sum up to less than the expected number', () => {
        const bcd = getLastMessagesUntilMaxTokens([
            {content: 'a', numTokens: 600, id: '', embedding: null, type: 'human', timestamp: 0, userId: '', username: ''}, // 2400
            {content: 'b', numTokens: 600, id: '', embedding: null, type: 'human', timestamp: 0, userId: '', username: ''}, // 1800
            {content: 'c', numTokens: 600, id: '', embedding: null, type: 'human', timestamp: 0, userId: '', username: ''}, // 1200
            {content: 'd', numTokens: 600, id: '', embedding: null, type: 'human', timestamp: 0, userId: '', username: ''}, // 600
        ], 2000);
        expect(bcd).toHaveLength(3);
        expect(bcd.map(item => item.content).join('')).to.eq('bcd');
    });
});
