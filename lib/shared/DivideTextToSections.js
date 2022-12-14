"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.divideTextToSections = void 0;
function divideTextToSections(message, maxLength) {
    let sectionStart = 0;
    let sectionEnd = 0;
    const nonWhitespaceRegex = /\S+$/;
    const sections = [];
    let currentCodeBlockStart = null;
    while (sectionEnd < message.length) {
        sectionEnd = Math.min(sectionStart + maxLength, message.length);
        let section = message.slice(sectionStart, sectionEnd);
        if (sectionEnd < message.length) {
            const nonWhitespaceMatch = section.match(nonWhitespaceRegex);
            if (nonWhitespaceMatch != null) {
                const matchLength = nonWhitespaceMatch[0].length;
                if (matchLength < section.length - 1) {
                    sectionEnd -= matchLength;
                }
                section = message.slice(sectionStart, sectionEnd);
            }
        }
        section = section.trimEnd();
        sectionStart = sectionStart + Math.max(section.length, 1);
        // handle code blocks...
        if (currentCodeBlockStart != null) {
            section = currentCodeBlockStart + '\n' + section;
            currentCodeBlockStart = null;
        }
        const codeBlockMatches = section.match(/```\S*/g);
        if (codeBlockMatches != null && codeBlockMatches.length % 2 === 1) {
            const lastCodeBlock = codeBlockMatches[codeBlockMatches.length - 1];
            // console.log({section, lastCodeBlock});
            currentCodeBlockStart = lastCodeBlock;
            // close code block in section
            section += '\n```';
        }
        sections.push(section);
    }
    return sections;
}
exports.divideTextToSections = divideTextToSections;
//# sourceMappingURL=DivideTextToSections.js.map