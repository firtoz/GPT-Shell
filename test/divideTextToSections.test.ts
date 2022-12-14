import {it, expect, describe} from 'vitest';

import {divideTextToSections} from "../src/shared/DivideTextToSections";

describe('divideTextToSections', () => {
    it('should correctly break text into expected sections', () => {
        const message = 'This is a test message';
        const maxLength = 10;
        const expectedSections = ['This is a', ' test', ' message'];

        const sections = divideTextToSections(message, maxLength);

        expect(sections).toEqual(expectedSections);
    });

    it('should not divide if the message is shorter than the max length', () => {
        const message = 'This is a test message';
        const maxLength = 100;
        const expectedSections = ['This is a test message'];

        const sections = divideTextToSections(message, maxLength);

        expect(sections).toEqual(expectedSections);
    });

    it('should correctly break text with very long words into expected sections', () => {
        const message = 'abcd reallylongwordforreal hello';
        const maxLength = 20;
        const expectedSections = ['abcd', ' reallylongwordforre', 'al hello'];

        const sections = divideTextToSections(message, maxLength);

        expect(sections).toEqual(expectedSections);
    });

    it('should handle code blocks correctly', () => {
        const message = 'This is a ```js\ntest message\n```';
        const maxLength = 20;
        const expectedSections = ['This is a ```js\n```', '```js\n\ntest message\n```'];

        const sections = divideTextToSections(message, maxLength);

        expect(sections).toEqual(expectedSections);
    });

    it('should respect the maximum length of each section', () => {
        const message = 'This is a test message that is longer than the maximum length';
        const maxLength = 10;
        const expectedSections = [
            'This is a',
            ' test',
            ' message',
            ' that is',
            ' longer',
            ' than the',
            ' maximum',
            ' length',
        ];

        const sections = divideTextToSections(message, maxLength);

        expect(sections).toEqual(expectedSections);
    });

    it('should return an empty array for empty string', () => {
        const message = '';
        const maxLength = 10;
        const expectedSections: string[] = [];

        const sections = divideTextToSections(message, maxLength);

        expect(sections).toEqual(expectedSections);
    });

    it('should handle edge cases', () => {
        const message = 'This is a test message that is exactly the maximum length';
        const maxLength = 30;
        const expectedSections = [
            'This is a test message that',
            ' is exactly the maximum length'
        ];

        const sections = divideTextToSections(message, maxLength);

        expect(sections).toEqual(expectedSections);
    });
});
