# Commands Implementation Details

This document covers the project-specific custom commands that enhance editing beyond standard ProseMirror behavior. For general ProseMirror command concepts, see the [ProseMirror Library Guide](../../../CLAUDE.md).

## Custom Command Algorithms

The implementation includes five key custom behaviors:
- **customBackspace** - Block-to-paragraph conversion instead of deletion
- **customJoinBackward** - Intelligent block joining with structural awareness  
- **customSinkListItem** - Smart list indentation that preserves multi-paragraph structure
- **customLiftListItem** - Smart list outdentation that preserves multi-paragraph structure
- **Transform utilities** - Document manipulation helpers
- **Debug support** - Optional debug logging for command tracing

## Core Commands

### customBackspace Algorithm

**Key Innovation**: At block start, converts block to paragraph instead of deleting content.

**Implementation**: `customBackspace(schema)` in [commands.js](commands.js)

**Fallback Chain**:
1. Block reset (heading/blockquote → paragraph)
2. List handling:
   - **Multi-paragraph detection**: If cursor is at start of second+ paragraph in list item, use `lift` to extract paragraph from list
   - **Nested list handling**: 
     - If first item in nested list: use `joinBackward` to merge with ancestor list item
     - If not first item in nested list: use `lift` to extract paragraph content (removes bullet)
   - **Standard list lifting**: Use `liftListItem` for single-paragraph list items
3. Standard ProseMirror fallbacks (lift → customJoinBackward → joinBackward → selectNodeBackward)

### customJoinBackward Algorithm  

**Key Innovation**: Uses `findCutBefore()` and `deleteBarrier()` for intelligent block joining.

**Implementation**: `customJoinBackward(schema)` in [commands.js](commands.js)

**Process**: Verify cursor at block start → find cut position using `findCutBefore()` → execute barrier removal with `deleteBarrier()`

### customSinkListItem Algorithm

**Key Innovation**: Preserves multi-paragraph list item structure by skipping indentation.

**Implementation**: `customSinkListItem(schema)` in [commands.js](commands.js)

**Logic**: Check if current list item contains multiple paragraphs → if yes and cursor is in second+ paragraph, return false (skip sinking) → otherwise use standard `sinkListItem` behavior

### customLiftListItem Algorithm

**Key Innovation**: Preserves multi-paragraph list item structure by skipping outdentation.

**Implementation**: `customLiftListItem(schema)` in [commands.js](commands.js)

**Logic**: Check if current list item contains multiple paragraphs → if yes and cursor is in second+ paragraph, return false (skip lifting) → otherwise use standard `liftListItem` behavior

## Transform Utilities

**Implementation**: Helper functions in [transforms.js](transforms.js)

- **`atBlockStart()`** - Detects cursor at block beginning
- **`findCutBefore()`** - Finds optimal position for block joining  
- **`deleteBarrier()`** - Removes structural barriers between nodes

## Keymap Integration

**Implementation**: Commands bound to keyboard shortcuts in [../editor/menu.js](../editor/menu.js):
- `customBackspace` bound to 'Backspace' key
- `customSinkListItem` bound to 'Tab' key
- `customLiftListItem` bound to 'Shift-Tab' key