import { defaultMarkdownSerializer } from 'prosemirror-markdown';

/**
 * Markdown serializer for converting ProseMirror documents back to markdown text
 * Uses the default markdown serializer from prosemirror-markdown
 */

// Use the default markdown serializer from prosemirror-markdown
export const markdownSerializer = defaultMarkdownSerializer;

/**
 * Serialize a ProseMirror document to markdown text
 * @param {Node} doc - The ProseMirror document to serialize
 * @returns {string} Markdown text
 */
export function serializeMarkdown(doc) {
    return markdownSerializer.serialize(doc);
}