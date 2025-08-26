# ProseMirror Markdown Editor

## Project Description

This is a modern WYSIWYG markdown editor built with ProseMirror that provides seamless bidirectional conversion between rich text editing and raw markdown. The project demonstrates ProseMirror's powerful document model and state management system for building sophisticated text editors.

**Repository Structure**: This project is part of a larger repository (`editor-md`) that contains the main editor implementation plus reference copies of original ProseMirror packages:
- `prosemirror-md/` - **Main editor implementation** (this package)
- `prosemirror-menu/`, `prosemirror-commands/`, `prosemirror-example-setup/` - Reference implementations of original ProseMirror packages (for study/reference only)

**Dependencies**: The editor depends on official ProseMirror npm packages and implements its own custom menu system and commands within the `src/` directory. The sibling directories are just reference copies of the original ProseMirror source code for learning and comparison purposes.

## Architecture Overview

### Core Components

- **`src/main.js`** - Entry point that initializes the editor manager and handles view switching
- **`src/editor/`** - Editor view implementations
  - **`wysiwyg-view.js`** - ProseMirror-based WYSIWYG editor
  - **`markdown-view.js`** - Simple textarea-based markdown editor
  - **`menu.js`** - Menu configuration and integration for the WYSIWYG editor
  - **`inputrules.js`** - Smart input rules for markdown shortcuts
- **`src/markdown/`** - Markdown parsing and serialization
  - **`schema.js`** - ProseMirror schema for markdown documents
  - **`parser.js`** - Markdown to ProseMirror document parser
  - **`serializer.js`** - ProseMirror to markdown serializer
- **`src/menu/`** - Reusable menu system components
  - **`menu.js`** - Core MenuItem class and menu utilities
  - **`menu.d.ts`** - TypeScript definitions for menu components
  - **`menubar.js`** - MenuBar component for toolbar rendering
  - **`icons.js`** - SVG icons for menu items
  - **`index.js`** - Public API exports
- **`src/commands/`** - Custom ProseMirror commands
  - **`commands.js`** - Custom backspace and join commands
  - **`transforms.js`** - Document transformation utilities
  - **`index.js`** - Command exports

### Key Features

- **Bidirectional Conversion** - Seamless switching between WYSIWYG and markdown modes
- **Modern Architecture** - Built on ProseMirror's immutable document model
- **Rich Editing** - Full ProseMirror editing capabilities with toolbar and shortcuts  
- **Markdown Fidelity** - Preserves markdown structure during conversion
- **Extensible Design** - Plugin-based architecture for custom functionality
- **Performance Optimized** - ESM modules with import maps and modulepreload
- **Custom Menu System** - Reusable menu components with optimized state management
- **Enhanced Commands** - Custom backspace behavior and improved text editing

## ProseMirror Concepts

### Document Model
ProseMirror uses an immutable tree-based document model:
- **Nodes** represent document structure (paragraphs, headings, lists)
- **Marks** represent inline formatting (bold, italic, links)
- **Schema** defines valid document structure and content rules
- **Transactions** describe document changes in a persistent way

### State Management
- **EditorState** contains the complete editor state (document, selection, plugins)
- **Transactions** are used to update state immutably
- **Plugins** extend functionality and can maintain their own state
- **Commands** are functions that create and dispatch transactions

### View System
- **EditorView** renders the document and handles user interaction
- **Node Views** allow custom rendering of specific node types
- **Decorations** can add visual elements without changing the document

## Critical Setup Requirements

### Import Map Management

**⚠️ IMPORTANT**: When adding new ProseMirror packages or dependencies, you MUST update three locations:

1. **`index.html`** - Import map section:
   ```html
   <script type="importmap">
   {
       "imports": {
           "new-prosemirror-package": "./node_modules/new-prosemirror-package/dist/index.js"
       }
   }
   </script>
   ```

2. **`index.html`** - Modulepreload section:
   ```html
   <link rel="modulepreload" href="./node_modules/new-prosemirror-package/dist/index.js">
   ```

3. **`vite.config.js`** - OptimizeDeps include array:
   ```js
   optimizeDeps: {
       include: [
           'new-prosemirror-package'
       ]
   }
   ```

### Schema Configuration

The markdown schema extends ProseMirror's basic schema:
```js
const markdownNodes = addListNodes(
    basicSchema.spec.nodes, 
    "paragraph block*", 
    "block"
);

export const markdownSchema = new Schema({
    nodes: markdownNodes,
    marks: basicSchema.spec.marks
});
```

## Development Commands

```bash
# Navigate to prosemirror-md directory (within the editor-md repo)
cd prosemirror-md

# Install dependencies
npm install

# Start development server (the user should run themselves)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Build for GitHub Pages deployment
npm run build:gh-pages

# Deploy to GitHub Pages (combines build:gh-pages)
npm run deploy

# Run linting (ESLint configuration)
npx eslint src/
```

## Package Dependencies

### Core ProseMirror Packages
- `prosemirror-state` - State management and transactions
- `prosemirror-view` - Editor view and DOM management
- `prosemirror-model` - Document model and schema system
- `prosemirror-markdown` - Markdown parsing and serialization

### Schema and Content Packages
- `prosemirror-schema-basic` - Basic document nodes and marks
- `prosemirror-schema-list` - List node support (bullet_list, ordered_list, list_item)

### Editing Features
- `prosemirror-example-setup` - Pre-configured toolbar and basic editing features
- `prosemirror-keymap` - Keyboard shortcut handling
- `prosemirror-commands` - Common editing commands
- `prosemirror-history` - Undo/redo functionality
- `prosemirror-inputrules` - Smart input rules (e.g., typing "# " creates heading)

### UI Components
- `prosemirror-dropcursor` - Visual cursor when dropping content
- `prosemirror-gapcursor` - Cursor for positions between block nodes
- `prosemirror-menu` - Toolbar menu system

### External Dependencies
- `markdown-it` - Markdown parsing library used by prosemirror-markdown

## Editor Architecture

Dual-mode editing system that seamlessly switches between WYSIWYG and markdown editing modes.

### Core Components
- **EditorManager** - Orchestrates mode switching and content conversion
- **ProseMirrorView** - Rich text WYSIWYG editor with full ProseMirror capabilities  
- **MarkdownView** - Enhanced textarea for direct markdown editing
- **Plugin Integration** - Menu system, input rules, and custom commands

### Key Features
- **Seamless Switching** - Instant mode transitions with content preservation
- **Smart Input Rules** - Type `#` + space for headings, `*` + space for lists
- **Enhanced Textarea** - Auto-resize, tab handling, keyboard shortcuts
- **Markdown-like Styling** - WYSIWYG visually resembles rendered markdown
- **Focus Management** - Proper focus handling during mode transitions

### Plugin Stack
The WYSIWYG editor includes history, drop cursor, gap cursor, custom menu system, input rules for smart typing, enhanced commands, and markdown-like styling.

For detailed implementation information, see [src/editor/CLAUDE.md](src/editor/CLAUDE.md).

## Extension Development Guidelines

### Creating Custom Plugins

```js
import { Plugin, PluginKey } from 'prosemirror-state';

const myPlugin = new Plugin({
    key: new PluginKey('myPlugin'),
    
    // Plugin state
    state: {
        init: () => ({}),
        apply: (tr, value) => value
    },
    
    // DOM properties
    props: {
        attributes: { class: 'my-plugin' },
        handleKeyDown: (view, event) => { /* handle keys */ }
    }
});
```

### Custom Node Views

```js
class CustomNodeView {
    constructor(node, view, getPos) {
        this.node = node;
        this.view = view;
        this.getPos = getPos;
        
        // Create DOM representation
        this.dom = document.createElement('div');
        this.dom.className = 'custom-node';
        
        // Make contenteditable if needed
        this.contentDOM = this.dom;
    }
    
    update(node) {
        if (node.type != this.node.type) return false;
        this.node = node;
        return true;
    }
    
    destroy() {
        // Cleanup
    }
}
```

### Schema Extensions

```js
const myNodes = {
    custom_block: {
        content: "text*",
        group: "block",
        parseDOM: [{ tag: "div.custom" }],
        toDOM: () => ["div", { class: "custom" }, 0]
    }
};

const extendedSchema = new Schema({
    nodes: markdownSchema.spec.nodes.append(myNodes),
    marks: markdownSchema.spec.marks
});
```

## Performance Considerations

### Import Optimization
- **Import Maps** - Clean module resolution without full paths
- **Modulepreload** - Preload critical modules to prevent loading delays
- **Vite Pre-bundling** - Dependencies are optimized during development

### Document Efficiency
- **Immutable Updates** - ProseMirror's transaction system prevents unnecessary re-renders
- **Incremental Parsing** - Only changed content is re-parsed during view switches
- **Lazy Loading** - Heavy features can be loaded on demand

## Markdown Processing

Bidirectional conversion system between markdown text and ProseMirror documents with high fidelity.

### Core Components
- **Schema** - ProseMirror document structure definition for markdown elements
- **Parser** - Converts markdown text to ProseMirror documents using markdown-it
- **Serializer** - Converts ProseMirror documents back to clean markdown text

### Supported Elements
All standard markdown syntax including headings, lists, blockquotes, code blocks, emphasis, links, and horizontal rules. The system maintains proper nesting rules and content validation.

### Conversion Features
- **High Fidelity** - Preserves content and structure across conversions
- **Error Handling** - Graceful degradation for invalid markdown
- **Performance** - Efficient parsing and serialization for large documents
- **Extensible** - Schema can be extended with custom markdown elements

### Usage
The conversion functions integrate seamlessly with the editor's mode switching, automatically handling content transformation when users switch between WYSIWYG and markdown views.

For detailed implementation information, see [src/markdown/CLAUDE.md](src/markdown/CLAUDE.md).

## Styling System

### CSS Architecture

The styling follows a modular approach:
- **Layout styles** - App structure and responsive design
- **Editor styles** - Basic editor appearance
- **Markdown styles** - Typography matching rendered markdown
- **Component styles** - UI components and interactions

### Markdown-like WYSIWYG Styling

Key visual elements that match markdown rendering:
```css
.ProseMirror h1 {
    font-size: 2em;
    font-weight: 600;
    border-bottom: 1px solid #e9ecef;
}

.ProseMirror blockquote {
    border-left: 4px solid #e9ecef;
    padding-left: 1rem;
    color: #6c757d;
    font-style: italic;
}
```

## GitHub Pages Deployment

### Automatic Deployment

The project includes GitHub Actions configuration for automatic deployment:
- **Base Path**: `/prosemirror-md/` (configured in `vite.config.js`)
- **Build Command**: `npm run build:gh-pages`
- **Deploy Target**: `dist/` directory

### Manual Deployment

```bash
# Build for GitHub Pages
npm run build:gh-pages

# The dist/ folder can be deployed to any static hosting
```

## Differences from CodeMirror Implementation

### Architectural Differences

| Aspect | CodeMirror 6 | ProseMirror |
|--------|--------------|-------------|
| **Document Model** | Text-based with decorations | Tree-based with nodes and marks |
| **State Management** | Transactions on text | Immutable document transformations |
| **Extensibility** | Extensions and facets | Plugins and schema |
| **Rendering** | Line-based virtual DOM | Full document virtual DOM |
| **Undo/Redo** | Built-in history | Plugin-based history |

### Use Case Differences

**CodeMirror 6 is better for:**
- Code editing with syntax highlighting
- Large documents with performance requirements
- Line-oriented editing features
- Minimal overhead text editing

**ProseMirror is better for:**
- Rich text editing with structured content
- Document-oriented applications
- Complex content transformations
- Collaborative editing features

## Troubleshooting

### Common Issues

#### Module Resolution Errors
- Ensure all ProseMirror packages are in import map
- Check modulepreload links match import map paths
- Verify Vite optimizeDeps includes all dependencies

#### Schema Validation Errors
- Ensure content expressions are valid (e.g., "paragraph block*")
- Check that all referenced node types exist in schema
- Validate mark compatibility with node content

#### Conversion Issues
- Parser errors usually indicate invalid markdown input
- Serializer issues often stem from custom nodes not having serializers
- Content loss during conversion suggests schema mismatches

### Development Tools

```js
// Debug document structure
console.log(JSON.stringify(view.state.doc.toJSON(), null, 2));

// Inspect current selection
console.log(view.state.selection);

// Check plugin state
const pluginState = myPlugin.getState(view.state);

// Monitor transactions
view.setProps({
    dispatchTransaction(transaction) {
        console.log('Transaction:', transaction);
        view.updateState(view.state.apply(transaction));
    }
});
```

### Performance Debugging

- Use browser DevTools Performance tab during editing
- Monitor for memory leaks during view switching
- Check bundle size with `npm run build` and analyze chunks

## Extension Points

### Custom Commands
```js
import { toggleMark, setBlockType } from 'prosemirror-commands';

const myCommands = {
    toggleBold: toggleMark(schema.marks.strong),
    makeHeading: setBlockType(schema.nodes.heading, { level: 1 })
};
```

### Input Rules
```js
import { inputRules, wrappingInputRule } from 'prosemirror-inputrules';

const blockquoteRule = wrappingInputRule(
    /^\s*>\s$/,
    schema.nodes.blockquote
);

const myInputRules = inputRules({ rules: [blockquoteRule] });
```

### Menu Integration
```js
import { menuBar, MenuItem } from 'prosemirror-menu';

const menu = menuBar({
    content: [
        [new MenuItem({
            title: "Strong",
            icon: strongIcon,
            cmd: toggleMark(schema.marks.strong)
        })]
    ]
});
```

## Menu System

Custom-built toolbar system with optimized state management for ProseMirror editors.

### Architecture
- **MenuItem** class - Encapsulates menu item behavior with smart state caching
- **MenuBar** component - Renders grouped toolbar items with separators
- **StateContext** - Performance optimization that caches expensive state calculations
- **Icons** - SVG-based icon system with flexible rendering options
- **TypeScript** definitions for IDE support

### Key Features
- Smart active state detection (only active when entire selection has mark)
- Optimized DOM updates through state caching
- Flexible icon system (text, SVG, or custom DOM)
- Keyboard shortcut integration
- Enhanced toggle behavior that prioritizes applying marks

### Usage Pattern
Create MenuItem instances with commands and display properties, group them into arrays for toolbar sections, then initialize MenuBar. The menu plugin handles ProseMirror integration automatically.

For detailed implementation information, see [src/menu/CLAUDE.md](src/menu/CLAUDE.md).

## Custom Commands

Enhanced editing commands that provide more intuitive behavior than standard ProseMirror commands.

### Available Commands
- **customBackspace** - Smart backspace that converts blocks to paragraphs instead of deleting content
- **customJoinBackward** - Improved block joining with better structural understanding
- **Transform utilities** - Low-level helpers for document manipulation

### Key Improvements
- **Block Reset**: At start of headings/blockquotes, backspace converts to paragraph rather than deleting
- **List Handling**: Smart list item lifting and management
- **Structural Awareness**: Commands understand document structure for better joining behavior
- **Fallback Chain**: Multiple strategies ensure robust editing in edge cases

### Usage
Commands integrate with ProseMirror's keymap system and are bound to standard keys like 'Backspace'. They follow ProseMirror's command signature and chain properly with other commands.

For detailed implementation information, see [src/commands/CLAUDE.md](src/commands/CLAUDE.md).

This documentation provides a comprehensive guide to understanding, developing, and extending the ProseMirror markdown editor. The modular architecture and clear separation of concerns make it easy to customize and enhance for specific use cases.
