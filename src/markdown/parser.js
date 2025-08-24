import { MarkdownParser } from 'prosemirror-markdown';
import { markdownSchema } from './schema.js';

/**
 * Markdown parser configuration for converting markdown text
 * to ProseMirror document nodes
 */

// Create parser with our custom schema
export const markdownParser = MarkdownParser.fromSchema(markdownSchema, {
    // Blockquote parsing
    blockquote: {
        block: "blockquote",
        wrap: true
    },
    
    // Paragraph parsing
    paragraph: {
        block: "paragraph"
    },
    
    // List item parsing
    list_item: {
        block: "list_item",
        wrap: true
    },
    
    // Bullet list parsing
    bullet_list: {
        block: "bullet_list",
        wrap: true,
        getAttrs: () => ({ tight: false })
    },
    
    // Ordered list parsing
    ordered_list: {
        block: "ordered_list", 
        wrap: true,
        getAttrs: (tok) => ({ 
            tight: false,
            start: tok.attrGet("start") ? +tok.attrGet("start") : 1
        })
    },
    
    // Heading parsing (H1-H6)
    heading: {
        block: "heading",
        getAttrs: (tok) => ({ level: +tok.tag.slice(1) })
    },
    
    // Code block parsing
    code_block: {
        block: "code_block",
        noCloseToken: true,
        getAttrs: (tok) => ({ params: tok.info || "" })
    },
    
    // Horizontal rule parsing
    hr: {
        node: "horizontal_rule"
    },
    
    // Image parsing
    image: {
        node: "image",
        getAttrs: (tok) => ({
            src: tok.attrGet("src"),
            title: tok.attrGet("title") || null,
            alt: (tok.children && tok.children[0] && tok.children[0].content) || null
        })
    },
    
    // Hard break parsing
    hardbreak: {
        node: "hard_break"
    },
    
    // Emphasis (italic) parsing
    em_open: { mark: "em" },
    em_close: { mark: "em" },
    
    // Strong (bold) parsing  
    strong_open: { mark: "strong" },
    strong_close: { mark: "strong" },
    
    // Inline code parsing
    code_inline: {
        mark: "code",
        noCloseToken: true
    },
    
    // Link parsing
    link_open: {
        mark: "link",
        getAttrs: (tok) => ({
            href: tok.attrGet("href"),
            title: tok.attrGet("title") || null
        })
    },
    link_close: { mark: "link" }
});

/**
 * Parse markdown text into a ProseMirror document
 * @param {string} markdown - The markdown text to parse
 * @returns {Node} ProseMirror document node
 */
export function parseMarkdown(markdown) {
    return markdownParser.parse(markdown);
}