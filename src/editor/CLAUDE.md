# Editor Implementation Details

This document covers the project-specific dual-mode editor implementation. For general ProseMirror concepts, see the [ProseMirror Library Guide](../../CLAUDE.md).

## Dual-Mode Architecture

The key innovation of this implementation is seamless switching between WYSIWYG and plain text markdown editing:
- **EditorManager** - Orchestrates mode switching with content conversion
- **ProseMirrorView** - Rich text editor with markdown-like styling  
- **MarkdownView** - Enhanced textarea with smart markdown features
- **Content conversion** - Automatic transformation during mode switches

## Core Implementation

### EditorManager

**Implementation**: `EditorManager` class in [main.js](../main.js)

**Mode Switching Algorithm**:
1. Extract content from current view
2. Convert content format (markdown ↔ ProseMirror document)
3. Destroy current view and initialize new view
4. Restore focus to new view

### ProseMirrorView (WYSIWYG Mode)

**Implementation**: `ProseMirrorView` class in [wysiwyg-view.js](wysiwyg-view.js)

**Custom Plugin Stack**:
- Core: history, drop cursor, gap cursor
- Smart typing: `createInputRules()` for markdown shortcuts
- UI: `menuPlugin()` with custom toolbar
- Commands: `createKeymap()` with enhanced backspace
- Styling: `createMarkdownStylingPlugin()` for markdown-like appearance

### MarkdownView (Plain Text Mode)

**Implementation**: `MarkdownView` class in [markdown-view.js](markdown-view.js)

**Enhanced Features**:
- Auto-resize textarea with minimum height (300px)
- Tab insertion (4 spaces) with proper cursor positioning
- IME composition tracking for international input
- Cursor position management with preservation options
- Smart focus management with optional focus control
- Grammar checking disabled for better performance

## Component Integration

### Menu Integration
**Implementation**: `menuPlugin()` and `createKeymap()` in [menu.js](menu.js) - integrates custom menu with ProseMirror editor and coordinates keyboard shortcuts.

### Input Rules  
**Implementation**: `createInputRules()` in [inputrules.js](inputrules.js) - smart typing patterns (# → heading, * → list, > → blockquote, --- → horizontal rule).

### Plugin Coordination
**Plugin Order (from wysiwyg-view.js)**:
1. Core editing: history(), dropCursor(), gapCursor()
2. Smart input: createInputRules() for markdown shortcuts
3. Keymaps: createKeymap() with custom commands, baseKeymap() fallback
4. UI: menuPlugin() toolbar, createMarkdownStylingPlugin() styling  
5. Fallback: Tab key handling prevention

## Dual-Mode Lifecycle

### Content Synchronization
**Key Feature**: Seamless content conversion during mode switching:
- WYSIWYG → Markdown: `serializeMarkdown(view.state.doc)`  
- Markdown → WYSIWYG: `parseMarkdown(textContent)`
- Error handling with fallback to last known good state

### View Destruction and Cleanup
**Memory Management**: Proper cleanup during view switching - remove event listeners, destroy ProseMirror view, clear DOM references, and reset focus state.

## Styling Integration

### Markdown-like WYSIWYG Styling
**Implementation**: `createMarkdownStylingPlugin()` in [wysiwyg-view.js](wysiwyg-view.js) - makes rich text editor visually similar to rendered markdown with proper heading sizes, blockquote borders, code block backgrounds, and list styling.