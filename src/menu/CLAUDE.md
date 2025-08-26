# Menu System Implementation Details

This document covers the implementation details of the custom menu system for ProseMirror editors. The menu system provides optimized toolbar components with smart state management.

## Overview

The menu system is built around three core concepts:
- **MenuItem** - Individual menu item with command binding and state management
- **MenuBar** - Container that renders groups of menu items
- **StateContext** - Optimization layer that caches expensive state calculations

## Core Components

### MenuItem Class

The MenuItem class encapsulates menu item behavior including rendering, state management, and user interaction.

**Key Features**:
- Optimized DOM updates through state caching
- Flexible icon system (text, SVG, HTML)
- Proper focus and event handling
- Integration with ProseMirror command system

**Implementation**: `MenuItem` class in [menu.js](menu.js)

**State Management Methods**:
- `render()` - Creates DOM element and returns update function
- `update()` - Updates item state (active, enabled, visible)
- Internal caching prevents unnecessary DOM manipulation

### MenuBar Component

Renders a complete toolbar with grouped menu items.

**Implementation**: `MenuBar` class in [menubar.js](menubar.js)

**Features**:
- Automatic grouping with separators
- Responsive layout
- Event delegation for performance

### StateContext Optimization

The StateContext is a performance optimization that caches expensive state calculations across all menu items in a single transaction.

**Problem Solved**: Without caching, each menu item would independently check mark/block active states, leading to redundant document traversals.

**Implementation**: 
- `MenuPlugin.computeContext()` in [menu.js](menu.js)
- Called once per transaction
- Passed to all menu item update functions

**Cached Operations**:
- Mark active state detection
- Block type active state detection
- Command availability checks
- Node insertion capabilities

### Icon System

Provides flexible icon rendering with multiple format support.

**Implementation**: Icon definitions in [icons.js](icons.js)

**Supported Formats**:
- SVG path data with viewBox
- Text with optional CSS styling
- HTML strings (legacy support)
- Custom DOM nodes

## Custom Commands Integration

### customToggleMark Function

Provides improved mark toggle behavior compared to standard ProseMirror `toggleMark`.

**Key Differences**:
1. Active state based on ENTIRE selection having the mark
2. Prioritizes applying marks over removing them
3. Consistent UX where button state matches action result

**Implementation**: `customToggleMark()` in [menu.js](menu.js)

**Algorithm**:
1. Check if selection is collapsed (use standard behavior)
2. Iterate through all text in selection
3. If any text lacks the mark, apply to entire selection
4. If all text has the mark, remove from entire selection

### Active State Detection

Two helper functions determine menu item states:

**markActive Function**:
- Checks if mark is active across entire selection
- Aligns with customToggleMark behavior
- Implementation: `markActive()` in [menu.js](menu.js)

**blockActive Function**:  
- Checks if current block matches specified node type
- Supports attribute matching
- Implementation: `blockActive()` in [menu.js](menu.js)

## Performance Optimizations

### DOM Update Caching

MenuItem instances cache three states to minimize DOM manipulation:
- `lastVisible` - Visibility state from select function
- `lastEnabled` - Enabled state from enable function  
- `lastActive` - Active state from active function

Only updates DOM when state actually changes between transactions.

### Event Handling

- Uses event delegation where possible
- Proper preventDefault and focus management
- Minimal event listener attachment

### Memory Management

- Proper cleanup in destroy methods
- Avoids memory leaks from event listeners
- Efficient DOM node reuse

## TypeScript Integration

Comprehensive type definitions provide IDE support and type safety.

**Key Interfaces**:
- `MenuItemSpec` - Configuration object for MenuItem
- `IconSpec` - Icon definition types
- `StateContext` - Context object interface
- `CommandFn` - ProseMirror command function signature

**Implementation**: Type definitions in [menu.d.ts](menu.d.ts)

## Extension Points

### Custom Menu Items

Create new menu items by implementing MenuItemSpec interface:
- `run` - Command function (required)
- `active` - Active state function
- `enable` - Enabled state function
- `select` - Visibility function
- Icon and styling options

### Custom Icons

Add new icons to the icon system:
- SVG path definitions in [icons.js](icons.js)
- Text-based icons with CSS
- Custom DOM node icons

### State Context Extensions

Extend StateContext with additional cached calculations:
- Add new methods to context computation
- Use in menu item state functions
- Maintain performance benefits

## Integration with ProseMirror

### Plugin Architecture

The menu system integrates as a ProseMirror plugin:
- `menuPlugin()` function creates plugin instance
- Handles view updates and state management
- Coordinates with other editor plugins

**Implementation**: `menuPlugin()` in [menu.js](menu.js)

### Command Binding

Menu items bind to ProseMirror commands:
- Standard commands from prosemirror-commands
- Custom commands from local implementation
- Schema-specific commands (toggleMark, setBlockType, etc.)

### Keyboard Shortcuts

Menu system coordinates with keyboard shortcuts:
- `createKeymap()` function generates keymap
- Links keyboard shortcuts to same commands as menu items
- Maintains consistent behavior across input methods

**Implementation**: `createKeymap()` in [menu.js](menu.js)

## Architecture Decisions

### Why Custom Implementation

Rather than using the official prosemirror-menu package:
1. **Better Performance** - StateContext caching reduces redundant calculations
2. **Improved UX** - customToggleMark provides more intuitive behavior
3. **Flexible Icons** - Multiple icon format support
4. **Type Safety** - Comprehensive TypeScript definitions
5. **Customization** - Easier to modify for specific needs

### State Management Philosophy

The menu system follows ProseMirror's functional approach:
- Immutable state updates
- Pure functions for state calculations
- Explicit dependency on EditorState
- No hidden global state

### DOM Strategy

Minimal DOM manipulation approach:
- Create DOM structure once
- Update only changed properties
- Cache previous states to detect changes
- Use efficient CSS class toggling

This implementation provides a robust, performant menu system that integrates seamlessly with ProseMirror while offering enhanced user experience and developer flexibility.