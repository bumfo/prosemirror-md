import { defaultMarkdownParser } from 'prosemirror-markdown';

/**
 * Markdown parser for converting markdown text to ProseMirror document nodes
 * Uses the default markdown parser from prosemirror-markdown
 */

// Use the default markdown parser from prosemirror-markdown
export const markdownParser = defaultMarkdownParser;

/**
 * Parse markdown text into a ProseMirror document
 * @param {string} markdown - The markdown text to parse
 * @returns {Node} ProseMirror document node
 */
export function parseMarkdown(markdown) {
    return markdownParser.parse(markdown);
}