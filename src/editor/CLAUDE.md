# Editor Implementation Details

This document covers the implementation details of the editor components that provide the dual-mode WYSIWYG and markdown editing experience.

## Overview

The editor system provides a seamless dual-mode editing experience through:
- **EditorManager** - Orchestrates switching between editing modes
- **ProseMirrorView** - WYSIWYG rich text editor
- **MarkdownView** - Plain text markdown editor
- **Integration components** - Menu, input rules, and plugins

## Core Architecture

### EditorManager

Central coordinator that manages the editing experience and mode switching.

**Implementation**: `EditorManager` class in [main.js](../main.js)

**Key Responsibilities**:
- Initialize and manage editor views
- Handle mode switching (WYSIWYG ↔ Markdown)
- Coordinate content conversion between modes
- Manage focus and selection state
- Handle cleanup and memory management

**Mode Switching Algorithm**:
1. Extract content from current view
2. Convert content to target format (if needed)
3. Destroy current view and cleanup resources
4. Initialize new view with converted content
5. Restore focus to new view

### ProseMirrorView (WYSIWYG Mode)

Rich text editor implementation using ProseMirror for structured document editing.

**Implementation**: `ProseMirrorView` class in [wysiwyg-view.js](wysiwyg-view.js)

**Key Features**:
- Full ProseMirror editor with plugin system
- Custom menu integration
- Enhanced input rules for markdown shortcuts
- Custom command bindings
- Markdown-like visual styling

**Plugin Stack**:
- Core plugins: `history()`, `dropCursor()`, `gapCursor()`
- Input rules: `createInputRules()` for smart typing
- Menu system: `menuPlugin()` with toolbar
- Custom commands: `createKeymap()` with enhanced shortcuts
- Styling plugin: `createMarkdownStylingPlugin()`

**Initialization Process**:
1. Parse initial markdown content to ProseMirror document
2. Create EditorState with plugin stack
3. Initialize EditorView with custom dispatch
4. Apply styling classes and setup event handling

### MarkdownView (Plain Text Mode)

Simple textarea-based editor for direct markdown editing.

**Implementation**: `MarkdownView` class in [markdown-view.js](markdown-view.js)

**Key Features**:
- Enhanced textarea with markdown-aware behavior
- Auto-resize functionality
- Tab insertion support
- Keyboard shortcuts (Cmd/Ctrl+B, I for insertion)
- Proper font and styling

**Enhancement Features**:
- Smart tab handling for code blocks and lists
- Automatic height adjustment based on content
- Markdown shortcut insertion at cursor position
- Consistent focus management

## Component Integration

### Menu Integration

Connects the custom menu system with the ProseMirror editor.

**Implementation**: `menuPlugin()` and related functions in [menu.js](menu.js)

**Key Functions**:
- `menuPlugin()` - Creates ProseMirror plugin for menu integration
- `createKeymap()` - Generates keyboard shortcuts matching menu items
- Menu item configuration with custom commands and icons

**Integration Points**:
- Custom toggle commands for consistent UX
- Icon system coordination
- State management optimization
- Keyboard shortcut binding

### Input Rules

Smart typing shortcuts that convert text patterns into formatted content.

**Implementation**: `createInputRules()` in [inputrules.js](inputrules.js)

**Supported Patterns**:
- Headings: `#` + space → heading conversion
- Lists: `*` or `1.` + space → list item creation
- Blockquotes: `>` + space → blockquote wrapping
- Horizontal rules: `---` → horizontal rule insertion

**Implementation Strategy**:
- Uses ProseMirror's input rule system
- Pattern matching with regular expressions
- Node creation and wrapping logic
- Integration with schema definitions

### Plugin Coordination

The editor coordinates multiple ProseMirror plugins for enhanced functionality.

**Plugin Order Considerations**:
1. Core editing plugins (history, cursors)
2. Content transformation (input rules)
3. UI plugins (menu, styling)
4. Fallback keymaps (tab handling)

**Plugin Communication**:
- Shared access to editor state
- Coordinated transaction handling
- Event delegation and handling
- Resource cleanup coordination

## View Lifecycle Management

### Initialization

Both editor views follow initialization patterns:

**WYSIWYG View**:
1. Parse content with `parseMarkdown()`
2. Create plugin stack
3. Initialize ProseMirror state and view
4. Setup DOM classes and styling
5. Handle initial focus

**Markdown View**:
1. Create textarea element
2. Setup event listeners
3. Configure auto-resize behavior
4. Apply styling and attributes
5. Handle initial focus

### Content Synchronization

Content flows between views through conversion:
- WYSIWYG → Markdown: `serializeMarkdown(view.state.doc)`
- Markdown → WYSIWYG: `parseMarkdown(textContent)`
- Error handling for conversion failures
- Content validation and sanitization

### Cleanup and Destruction

Proper resource management during view switching:

**View Destruction**:
1. Remove event listeners
2. Destroy ProseMirror view (if applicable)
3. Clear DOM references
4. Release memory resources
5. Reset focus state

**Memory Management**:
- Avoid circular references
- Cleanup plugin state
- Remove DOM event handlers
- Clear timeouts and intervals

## Styling and Appearance

### Markdown-like WYSIWYG Styling

Makes the rich text editor visually similar to rendered markdown.

**Implementation**: `createMarkdownStylingPlugin()` in [wysiwyg-view.js](wysiwyg-view.js)

**Styling Strategy**:
- Headings with appropriate sizing and spacing
- Blockquotes with left border and styling
- Code blocks with monospace font and background
- Lists with proper indentation and markers
- Links with appropriate styling

**CSS Integration**:
- Plugin adds CSS classes to editor
- Styles defined in main stylesheet
- Responsive design considerations
- Consistent typography across modes

### Focus Management

Proper focus handling during mode switching:
- Preserve focus state during transitions
- Handle focus restoration after mode switch
- Coordinate with browser focus behavior
- Maintain accessibility standards

## Performance Considerations

### Initialization Performance

Optimization strategies for editor startup:
- Lazy loading of heavy components
- Efficient plugin initialization order
- Minimal DOM manipulation during setup
- Cached schema and parser instances

### Mode Switching Performance

Optimization for seamless mode transitions:
- Efficient content conversion algorithms
- Minimal DOM reconstruction
- Cached editor instances where possible
- Smooth animation and transition handling

### Memory Usage

Efficient memory management across modes:
- Proper cleanup of editor instances
- Resource pooling for frequently created objects
- Garbage collection friendly patterns
- Memory leak prevention

## Error Handling

### Content Conversion Errors

Handling failures during markdown ↔ ProseMirror conversion:
- Graceful degradation to plain text
- User notification of conversion issues
- Partial content recovery when possible
- Fallback to last known good state

### Editor Initialization Errors

Recovery from editor setup failures:
- Fallback editor implementations
- Error reporting and logging
- User-friendly error messages
- Graceful degradation of functionality

### Runtime Error Recovery

Handling errors during editor operation:
- Transaction rollback on failures
- State recovery mechanisms
- Plugin error isolation
- User notification and recovery options

## Development and Debugging

### Debug Tools

Development aids for editor troubleshooting:
- State inspection utilities
- Transaction logging
- Plugin state monitoring
- Performance profiling hooks

### Testing Strategy

Approaches for testing editor functionality:
- Unit tests for individual components
- Integration tests for mode switching
- User interaction simulation
- Cross-browser compatibility testing

## Architecture Decisions

### Why Dual-Mode Design

Rationale for supporting both editing modes:
1. **User Preference** - Some users prefer WYSIWYG, others prefer markdown
2. **Use Case Flexibility** - Different tasks benefit from different modes
3. **Learning Curve** - WYSIWYG more accessible, markdown more powerful
4. **Export Compatibility** - Direct markdown editing for precise control

### View Separation Strategy

Design decision to use separate view classes:
- **Clear Separation** - Each mode has distinct implementation
- **Focused Functionality** - Each view optimized for its use case
- **Maintainability** - Easier to modify and extend individual modes
- **Resource Management** - Only active view consumes resources

### Plugin Architecture Integration

How the editor integrates with ProseMirror's plugin system:
- **Standard Compliance** - Uses official ProseMirror patterns
- **Extension Friendly** - Easy to add custom plugins
- **Performance** - Optimized plugin coordination
- **Modularity** - Plugins can be selectively enabled/disabled

## Extension Points

### Custom Plugins

Adding new ProseMirror plugins to the editor:
1. Add plugin to plugin stack in view initialization
2. Configure plugin ordering as needed
3. Handle plugin-specific state management
4. Coordinate with existing plugins

### View Customization

Extending or modifying editor views:
- Override view methods for custom behavior
- Add new event handlers
- Modify styling and appearance
- Integrate additional UI components

### Menu System Extension

Adding new menu items or functionality:
- Use menu system API for new items
- Implement custom commands
- Add keyboard shortcuts
- Create custom icons

### Input Rule Extensions

Adding new smart typing patterns:
- Define new input rule patterns
- Implement transformation logic
- Handle edge cases and conflicts
- Coordinate with existing rules

This implementation provides a robust dual-mode editing experience that leverages ProseMirror's power while maintaining simplicity and user-friendliness.