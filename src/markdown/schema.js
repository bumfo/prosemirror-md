import { Schema } from 'prosemirror-model';
import { schema as basicSchema } from 'prosemirror-schema-basic';
import { addListNodes } from 'prosemirror-schema-list';

/**
 * Custom schema for markdown editing that extends the basic schema
 * with list support and markdown-specific configurations
 */

// Extend the basic schema with list nodes
const markdownNodes = addListNodes(
    basicSchema.spec.nodes, 
    "paragraph block*", 
    "block"
);

// Custom schema that matches markdown capabilities
export const markdownSchema = new Schema({
    nodes: markdownNodes,
    marks: basicSchema.spec.marks
});

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