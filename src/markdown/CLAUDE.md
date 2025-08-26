# Markdown Implementation Details

This document covers the project-specific markdown conversion implementation. For general ProseMirror concepts, see the [ProseMirror Library Guide](../../CLAUDE.md).

## Custom Implementation

The markdown system implements bidirectional conversion with high fidelity:
- **markdownSchema** - Extended ProseMirror schema for markdown elements
- **parseMarkdown()** - Markdown text → ProseMirror document conversion
- **serializeMarkdown()** - ProseMirror document → markdown text conversion

## Schema Definition

**Implementation**: `markdownSchema` in [schema.js](schema.js)

**Key Features**:
- Extends `basicSchema` with `addListNodes()` for markdown list support
- Content expression: `paragraph block*` allows proper markdown structure
- Standard markdown nodes: headings, blockquotes, code blocks, lists
- Standard marks: strong, em, code, link

## Parser Implementation

**Implementation**: `parseMarkdown()` in [parser.js](parser.js)

Uses `MarkdownParser.fromSchema()` with markdown-it to convert markdown tokens to ProseMirror nodes. Includes standard mappings for all markdown elements and graceful error handling.

## Serializer Implementation

**Implementation**: `serializeMarkdown()` in [serializer.js](serializer.js)

Uses `MarkdownSerializer` to convert ProseMirror documents back to clean markdown with proper formatting and syntax preservation.

## Integration Details

**Document Creation**: `parseMarkdown()` creates valid ProseMirror documents for editor initialization with proper schema validation.

**Content Extraction**: `serializeMarkdown()` extracts clean markdown from ProseMirror documents for storage and export.

**View Switching**: Conversion functions handle content transformation when users switch between WYSIWYG and markdown modes in the dual-mode editor.