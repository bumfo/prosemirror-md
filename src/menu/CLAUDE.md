# Menu System Implementation Details

This document covers the project-specific implementation details of the custom menu system. For general ProseMirror concepts, see the [ProseMirror Library Guide](../../CLAUDE.md).

## Custom Implementation Overview

The menu system implements several project-specific optimizations and behaviors:
- **Non-standard mark behavior** - Partial mark coverage shows inactive (prioritizes applying over removing)
- **StateContext** - Custom caching system for expensive state calculations  
- **Performance optimizations** - DOM update caching to minimize re-renders

## Core Components

### MenuItem Class

**Implementation**: `MenuItem` class in [menu.js](menu.js) - handles individual menu item rendering, event handling, and state management.

### MenuBar Component

**Implementation**: `MenuBar` class in [menubar.js](menubar.js)

### StateContext Optimization

**Implementation**: `StateContext` class in [menu.js](menu.js) - pre-computes expensive operations once per update cycle.

**Pre-computed Data**:
- Position resolvers: `$from`, `$to` via `doc.resolve()`  
- Block analysis: `parentNode`, `parentType`, `parentAttrs`, `selectionAtBlockEnd`
- Mark analysis: `marksAtPosition` (cursor) or `selectionMarks` (selection)
- Selection state: `empty`, `from`, `to`, `nodeSelection`

**Efficient Methods**: `isMarkActive()` and `isBlockActive()` provide O(1) lookups on cached data, supporting the custom "all-or-nothing" mark detection logic.

### Icon System

**Implementation**: Icon definitions in [icons.js](icons.js) - supports SVG HTML strings for all menu items.

## Custom Toggle Behavior vs Standard ProseMirror

### Key Behavioral Difference

**Standard prosemirror-menu**: Selection with partial mark coverage shows as "active" and clicking removes the mark from marked portions.

**Our Implementation**: Selection with partial mark coverage shows as "inactive" and clicking applies the mark to the entire selection.

### customToggleMark Algorithm

**Philosophy**: Prioritizes applying marks to complete selections over removing partial marks, providing more intuitive editing behavior.

**Implementation**: `customToggleMark()` in [menu.js](menu.js)

**Algorithm**:
1. **Collapsed selections**: Use standard ProseMirror behavior
2. **Text selections**: Check if ALL text nodes have the mark
   - If any text lacks mark → show inactive, apply mark to entire selection
   - If all text has mark → show active, remove mark from entire selection

**Example**: Select "**bold** normal text"
- **Standard behavior**: Bold button active, click removes bold from "bold"  
- **Our behavior**: Bold button inactive, click makes entire selection bold

### State Detection Functions

**markActive()** and **blockActive()** functions in [menu.js](menu.js) - align active state detection with the custom toggle behavior.

## Performance Optimizations

### DOM Update Caching
MenuItem instances cache `lastVisible`, `lastEnabled`, and `lastActive` states to only update DOM when state actually changes between transactions.

**Implementation**: Each MenuItem tracks three cached states:
```javascript
let lastVisible = null;
let lastEnabled = null; 
let lastActive = null;
```

**Optimization**: Only calls DOM manipulation methods (`setClass()`, `style.display`) when cached state differs from computed state.

### StateContext Performance Benefits
**Problem Solved**: Before optimization, each menu item (n ≈ 15) independently performed expensive operations (document traversals, position resolution, mark analysis).

**Complexity Reduction**: From O(n × m) to O(n + m) where n = menu items, m = expensive operations

**Key Operations Shared**:
- Document position resolution (`doc.resolve()` calls)
- Mark intersection analysis across text selections via `computeSelectionMarks()` (required for "all-or-nothing" mark detection)
- Parent node property lookups
- Selection boundary calculations

**Memory vs Speed Tradeoff**: Creates temporary StateContext per update but eliminates redundant computation, providing net performance gain for typical menu sizes (10-20 items).

## TypeScript Integration

**Implementation**: Comprehensive type definitions in [menu.d.ts](menu.d.ts) including `MenuItemSpec`, `StateContext`, and `IconSpec` interfaces.

## Plugin Integration

**menuBar()** function in [menubar.js](menubar.js) creates the ProseMirror plugin that coordinates menu state with editor transactions.

**createKeymap()** function in [../editor/menu.js](../editor/menu.js) generates keyboard shortcuts that use the same commands as menu items.
