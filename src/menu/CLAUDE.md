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

**Custom Algorithm**: Caches expensive state calculations once per transaction and passes results to all menu items, eliminating redundant document traversals.

**Implementation**: `MenuPlugin.computeContext()` in [menu.js](menu.js)

### Icon System

**Implementation**: Icon definitions in [icons.js](icons.js) - supports SVG paths, text, and HTML formats.

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

### StateContext Performance  
Single computation per transaction eliminates redundant document traversals across multiple menu items.

## TypeScript Integration

**Implementation**: Comprehensive type definitions in [menu.d.ts](menu.d.ts) including `MenuItemSpec`, `StateContext`, and `IconSpec` interfaces.

## Plugin Integration

**menuPlugin()** function in [menu.js](menu.js) creates the ProseMirror plugin that coordinates menu state with editor transactions.

**createKeymap()** function in [menu.js](menu.js) generates keyboard shortcuts that use the same commands as menu items.