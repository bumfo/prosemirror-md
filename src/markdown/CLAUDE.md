# Markdown Implementation Details

This document covers the project-specific markdown conversion implementation. For general ProseMirror concepts, see the [ProseMirror Library Guide](../../../CLAUDE.md).

## Custom Implementation

The markdown system implements bidirectional conversion with high fidelity:
- **markdownSchema** - Extended ProseMirror schema for markdown elements
- **parseMarkdown()** - Markdown text → ProseMirror document conversion
- **serializeMarkdown()** - ProseMirror document → markdown text conversion

## Schema Definition

**Implementation**: `markdownSchema` in [schema.js](schema.js)

**Key Features**:
- Uses default schema from `prosemirror-markdown` package directly
- Exports convenient node and mark references for easy access
- Standard markdown nodes: doc, paragraph, heading, blockquote, horizontal_rule, code_block, ordered_list, bullet_list, list_item, text, image, hard_break
- Standard marks: em, strong, link, code

## Parser Implementation

**Implementation**: Default CommonMark parser from prosemirror-markdown in [parser.js](parser.js)

**Key Components**:
- `markdownParser` - Uses `MarkdownParser` with MarkdownIt('commonmark') configuration
- Complete token mappings for all standard markdown elements
- `listIsTight()` helper - Determines tight vs loose list formatting
- Supports: blockquotes, paragraphs, lists, headings, code blocks, images, links, emphasis

**Token Mappings**:
- Block elements: blockquote, paragraph, list_item, bullet_list, ordered_list, heading, code_block
- Inline nodes: image, hard_break
- Marks: em, strong, link, code

## Serializer Implementation

**Implementation**: Default CommonMark serializer from prosemirror-markdown in [serializer.js](serializer.js)

**Key Components**:
- `markdownSerializer` - Converts ProseMirror documents to clean markdown
- `backticksFor()` helper - Calculates proper backtick escaping for code marks
- `isPlainURL()` helper - Detects auto-linkable URLs for cleaner output
- Smart formatting: proper list indentation, code fence detection, link handling

**Node Serializers**: Custom serialization functions for blockquote, code_block, heading, lists, images, etc.
**Mark Serializers**: Proper escaping and formatting for emphasis, strong, links, and inline code

## Integration Details

**Document Creation**: `parseMarkdown()` creates valid ProseMirror documents for editor initialization with proper schema validation.

**Content Extraction**: `serializeMarkdown()` extracts clean markdown from ProseMirror documents for storage and export.

**View Switching**: Conversion functions handle content transformation when users switch between WYSIWYG and markdown modes in the dual-mode editor.