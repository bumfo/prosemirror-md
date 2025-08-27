# Commands Implementation Details

This document covers the project-specific custom commands that enhance editing beyond standard ProseMirror behavior. For general ProseMirror command concepts, see the [ProseMirror Library Guide](../../../CLAUDE.md).

## Architecture Overview

The commands module is organized into focused, specialized files:
- **[commands.js](commands.js)** - Core commands (customBackspace, customJoinBackward)
- **[list_commands.js](list_commands.js)** - List-specific commands and helpers
- **[transforms.js](transforms.js)** - Low-level document transformation utilities
- **[util.js](util.js)** - Command helper utilities (cmd, funcToCommand)
- **[types.d.ts](types.d.ts)** - TypeScript type definitions
- **[index.js](index.js)** - Public API exports

## Command Utilities

### funcToCommand Helper

**Implementation**: `funcToCommand(func, scroll)` in [util.js](util.js)

**Purpose**: Converts transform functions that work directly on transactions into ProseMirror commands.

**Key Features**:
- Automatically handles transaction creation from editor state
- Optional scroll-into-view behavior (default: true)
- Simplified command signature for transform functions
- Proper dispatch handling and return values

**Usage Pattern**:
```javascript
// Transform function that modifies transaction directly
function myTransformFunc(tr, ...args) {
  // Modify tr directly
  tr.insertText('hello');
  return true; // Return false to cancel
}

// Convert to ProseMirror command
const myCommand = funcToCommand(myTransformFunc);
```

### cmd Helper

**Implementation**: `cmd(command)` in [util.js](util.js)

**Purpose**: Identity function for TypeScript type consistency and future extensibility.

## Custom Command Algorithms

The implementation includes core custom behaviors:
- **customBackspace** - Block-to-paragraph conversion with intelligent list handling
- **customJoinBackward** - Intelligent block joining with structural awareness  
- **backspaceList** - Smart list backspace behavior for multi-paragraph items
- **customSinkListItem** - Smart list indentation that preserves structure
- **customLiftListItem** - Smart list outdentation with multi-paragraph awareness
- **Transform utilities** - Low-level document manipulation helpers
- **Debug support** - Optional debug logging for command tracing

## Core Commands

### customBackspace Algorithm

**Key Innovation**: At block start, converts block to paragraph instead of deleting content.

**Implementation**: `customBackspace(schema)` in [commands.js](commands.js)

**Architecture**: Uses the `cmd()` helper to wrap the command logic and `backspaceList()` from list_commands.js for list-specific behavior.

**Fallback Chain**:
1. **Block reset** (heading/blockquote → paragraph) - handled directly
2. **List handling** - delegated to `backspaceList(itemType)` command
3. **Standard ProseMirror fallbacks** - lift → customJoinBackward → joinBackward → selectNodeBackward

### customJoinBackward Algorithm  

**Key Innovation**: Uses `findCutBefore()` and `customDeleteBarrier()` for intelligent block joining.

**Implementation**: `customJoinBackward(state, dispatch, view)` in [commands.js](commands.js)

**Architecture**: Direct command implementation (not schema-based factory) that works with transform utilities.

**Process**: Verify cursor at block start → find cut position using `findCutBefore()` → execute barrier removal with `customDeleteBarrier()`

## List Commands

### backspaceList Algorithm

**Key Innovation**: Handles backspace behavior specifically within lists, including multi-paragraph list items.

**Implementation**: `backspaceList(itemType)` in [list_commands.js](list_commands.js)

**Architecture**: Uses `funcToCommand()` to convert transform logic into a command.

**Logic**: 
1. Get list range using `getListRange()`
2. Check for multi-paragraph list items with `liftListParagraphFunc()`
3. Fallback to `liftOutOfListFunc()` for standard list lifting

### customSinkListItem Algorithm

**Key Innovation**: Preserves multi-paragraph list item structure by using validation before sinking.

**Implementation**: `customSinkListItem(schema)` in [list_commands.js](list_commands.js)

**Architecture**: Uses `cmd()` helper and `isListFirst()` validation helper.

**Logic**: Check if cursor is in first paragraph of multi-paragraph list item using `isListFirst()` → if not, return false (skip sinking) → otherwise use standard `sinkListItem` behavior

### customLiftListItem Algorithm

**Key Innovation**: Enhanced lifting behavior that handles multi-paragraph list items intelligently.

**Implementation**: `customLiftListItem(schema)` in [list_commands.js](list_commands.js)

**Architecture**: Uses `funcToCommand()` with transform-based logic.

**Logic**: 
1. Check for multi-paragraph scenarios with `liftListParagraphFunc()`
2. Fallback to `liftListItemFunc()` which chooses between `liftToOuterListFunc()` and `liftOutOfListFunc()` based on context

### Helper Functions

**List-specific helpers in [list_commands.js](list_commands.js)**:
- **`getListRange()`** - Finds block range for list operations
- **`isListFirst()`** - Validates if cursor is in first paragraph of multi-paragraph list item
- **`liftListParagraphFunc()`** - Handles lifting paragraphs from multi-paragraph list items
- **`splitListFunc()`** - Splits list items at specified position
- **`liftToOuterListFunc()`** - Lifts items to outer list level
- **`liftOutOfListFunc()`** - Completely lifts items out of list structure
- **`liftListItemFunc()`** - Orchestrates different lifting strategies
- **`mapping()`** - Helper for transaction position mapping

## Transform Utilities

**Implementation**: Low-level helper functions in [transforms.js](transforms.js)

- **`atBlockStart()`** - Detects cursor at block beginning
- **`findCutBefore()`** - Finds optimal position for block joining  
- **`customDeleteBarrier()`** - Removes structural barriers between nodes
- **`doJoin()`** - Core joining logic with content wrapping and merging

## Type System

**Implementation**: TypeScript definitions in [types.d.ts](types.d.ts)

**Key Types**:
- **`Command`** - Standard ProseMirror command signature
- **`Func`** - Transform function signature for `funcToCommand()`
- **`Transaction`** - ProseMirror transaction type
- **`EditorState`**, **`EditorView`**, **`ResolvedPos`**, **`Transform`** - Re-exported ProseMirror types

## Keymap Integration

**Implementation**: Commands bound to keyboard shortcuts in [../editor/menu.js](../editor/menu.js):
- `customBackspace` bound to 'Backspace' key
- `customSinkListItem` bound to 'Tab' key
- `customLiftListItem` bound to 'Shift-Tab' key

## Performance Optimizations

**funcToCommand Pattern**: The `funcToCommand()` utility enables:
- Direct transaction manipulation for better performance
- Reduced function call overhead
- Cleaner separation between command logic and ProseMirror integration
- Consistent transaction handling and dispatch behavior

**Modular Architecture**: Separation into focused files enables:
- Better code organization and maintainability
- Easier testing and debugging of specific functionality
- Clear separation of concerns between core commands and list-specific logic
- Reduced bundle size through better tree-shaking potential