import {it, expect, describe} from 'vitest';

import {getLastMessagesUntilMaxTokens} from "../src/core/ChatGPTConversation";

describe('getLastMessagesUntilMaxTokens', () => {
    it('should return messages that sum up to less than the expected number', () => {
        const bcd = getLastMessagesUntilMaxTokens([
            {content: 'a', numTokens: 600}, // 2400
            {content: 'b', numTokens: 600}, // 1800
            {content: 'c', numTokens: 600}, // 1200
            {content: 'd', numTokens: 600}, // 600
        ], 2000);
        expect(bcd).toHaveLength(3);
        expect(bcd.map(item => item.content).join('')).to.eq('bcd');
    });
});
