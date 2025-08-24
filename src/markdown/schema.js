import { schema } from 'prosemirror-markdown';

/**
 * Schema for markdown editing
 * Uses the default schema from prosemirror-markdown which is compatible
 * with CommonMark and includes all necessary nodes and marks
 */

// Use the default markdown schema from prosemirror-markdown
export const markdownSchema = schema;

// Export specific node and mark types for convenience
export const {
    doc,
    paragraph,
    heading,
    blockquote,
    horizontal_rule,
    code_block,
    ordered_list,
    bullet_list,
    list_item,
    text,
    image,
    hard_break
} = markdownSchema.nodes;

export const {
    em,
    strong,
    link,
    code
} = markdownSchema.marks;