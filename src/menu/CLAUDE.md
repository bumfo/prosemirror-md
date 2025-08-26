# Menu System Implementation Details

This document covers the project-specific implementation details of the custom menu system. For general ProseMirror concepts, see the [ProseMirror Library Guide](../../CLAUDE.md).

## Custom Implementation Overview

The menu system implements several project-specific optimizations and behaviors:
- **StateContext** - Custom caching system for expensive state calculations
- **customToggleMark** - Enhanced mark toggle behavior that prioritizes applying over removing
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

**Efficient Methods**: `isMarkActive()` and `isBlockActive()` provide O(1) lookups on cached data.

### Icon System

**Implementation**: Icon definitions in [icons.js](icons.js) - supports SVG HTML strings for all menu items.

## Custom Toggle Behavior

### customToggleMark Algorithm

**Key Innovation**: Unlike standard ProseMirror behavior, this implementation only shows active state when ENTIRE selection has the mark, and prioritizes applying marks over removing them.

**Implementation**: `customToggleMark()` in [menu.js](menu.js)

**Algorithm**:
1. For collapsed selections - use standard behavior
2. For text selections - iterate through all text nodes
3. If any text lacks mark → apply to entire selection  
4. If all text has mark → remove from entire selection

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
- Mark intersection analysis across text selections via `computeSelectionMarks()`  
- Parent node property lookups
- Selection boundary calculations

**Memory vs Speed Tradeoff**: Creates temporary StateContext per update but eliminates redundant computation, providing net performance gain for typical menu sizes (10-20 items).

## TypeScript Integration

**Implementation**: Comprehensive type definitions in [menu.d.ts](menu.d.ts) including `MenuItemSpec`, `StateContext`, and `IconSpec` interfaces.

## Plugin Integration

**menuBar()** function in [menubar.js](menubar.js) creates the ProseMirror plugin that coordinates menu state with editor transactions.

**createKeymap()** function in [../editor/menu.js](../editor/menu.js) generates keyboard shortcuts that use the same commands as menu items.
