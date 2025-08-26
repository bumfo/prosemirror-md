# Commands Implementation Details

This document covers the project-specific custom commands that enhance editing beyond standard ProseMirror behavior. For general ProseMirror command concepts, see the [ProseMirror Library Guide](../../../CLAUDE.md).

## Custom Command Algorithms

The implementation includes three key custom behaviors:
- **customBackspace** - Block-to-paragraph conversion instead of deletion
- **customJoinBackward** - Intelligent block joining with structural awareness  
- **Transform utilities** - Document manipulation helpers
- **Debug support** - Optional debug logging for command tracing

## Core Commands

### customBackspace Algorithm

**Key Innovation**: At block start, converts block to paragraph instead of deleting content.

**Implementation**: `customBackspace(schema)` in [commands.js](commands.js)

**Fallback Chain**:
1. Block reset (heading/blockquote → paragraph)
2. List handling (`liftListItem` for list items)
3. Standard ProseMirror fallbacks (lift → customJoinBackward → joinBackward → selectNodeBackward)

### customJoinBackward Algorithm  

**Key Innovation**: Uses `findCutBefore()` and `deleteBarrier()` for intelligent block joining.

**Implementation**: `customJoinBackward(schema)` in [commands.js](commands.js)

**Process**: Verify cursor at block start → find cut position using `findCutBefore()` → execute barrier removal with `deleteBarrier()`

## Transform Utilities

**Implementation**: Helper functions in [transforms.js](transforms.js)

- **`atBlockStart()`** - Detects cursor at block beginning
- **`findCutBefore()`** - Finds optimal position for block joining  
- **`deleteBarrier()`** - Removes structural barriers between nodes

## Keymap Integration

**Implementation**: Commands bound to keyboard shortcuts in [../editor/menu.js](../editor/menu.js) - `customBackspace` bound to 'Backspace' key.