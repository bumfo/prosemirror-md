# Menu System Implementation Details

This document covers the project-specific implementation details of the custom menu system. For general ProseMirror concepts, see the [ProseMirror Library Guide](../../CLAUDE.md).

## Custom Implementation Overview

The menu system implements several project-specific optimizations and behaviors:
- **StateContext** - Custom caching system for expensive state calculations
- **customToggleMark** - Enhanced mark toggle behavior that prioritizes applying over removing
- **Performance optimizations** - DOM update caching to minimize re-renders

## Core Components

### MenuItem Class

**Project-Specific Implementation**: The MenuItem class includes custom DOM update caching that tracks three states (`lastVisible`, `lastEnabled`, `lastActive`) to minimize DOM manipulation.

**Implementation**: `MenuItem` class in [menu.js](menu.js)

### MenuBar Component

**Implementation**: `MenuBar` class in [menubar.js](menubar.js)

### StateContext Optimization

**Performance Problem Solved**: Before optimization, menu updates had O(n × m) complexity where each menu item (n ≈ 15) independently performed expensive operations (m = document traversals, position resolution, mark analysis).

**Custom Algorithm**: StateContext pre-computes expensive operations once per update, reducing complexity from O(n × m) to O(n + m).

**Implementation**: `StateContext` class in [menu.js](menu.js)

**Pre-computed Data**:
- Position resolvers: `$from`, `$to` via `doc.resolve()`  
- Block analysis: `parentNode`, `parentType`, `parentAttrs`, `selectionAtBlockEnd`
- Mark analysis: `marksAtPosition` (cursor) or `selectionMarks` (selection)
- Selection state: `empty`, `from`, `to`, `nodeSelection`

**Mark Analysis Algorithm**: For selections, `computeSelectionMarks()` traverses all text nodes once, building intersection of marks present throughout entire selection.

**Efficient Lookups**: `isMarkActive()` and `isBlockActive()` methods provide O(1) lookups on pre-computed data instead of O(m) document traversals.

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

### StateContext Performance  
**Before**: O(n × m) - each menu item performed independent document analysis
**After**: O(n + m) - shared StateContext computes expensive operations once

**Key Operations Cached**:
- Document position resolution (`doc.resolve()` calls)
- Mark intersection analysis across text selections  
- Parent node property lookups
- Selection boundary calculations

**Memory vs Speed Tradeoff**: StateContext creates temporary objects per update but eliminates redundant computation, resulting in net performance gain for typical menu sizes (10-20 items).

## TypeScript Integration

**Implementation**: Comprehensive type definitions in [menu.d.ts](menu.d.ts) including `MenuItemSpec`, `StateContext`, and `IconSpec` interfaces.

## Plugin Integration

**menuBar()** function in [menubar.js](menubar.js) creates the ProseMirror plugin that coordinates menu state with editor transactions.

**createKeymap()** function in [../editor/menu.js](../editor/menu.js) generates keyboard shortcuts that use the same commands as menu items.
