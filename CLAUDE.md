# ProseMirror Markdown Editor

## Project Description

This is a modern WYSIWYG markdown editor built with ProseMirror that provides seamless bidirectional conversion between rich text editing and raw markdown. The project demonstrates ProseMirror's powerful document model and state management system for building sophisticated text editors.

## Architecture Overview

### Core Components

- **`src/main.js`** - Entry point that initializes the editor manager and handles view switching
- **`src/editor/`** - Editor view implementations
  - **`wysiwyg-view.js`** - ProseMirror-based WYSIWYG editor
  - **`markdown-view.js`** - Simple textarea-based markdown editor
- **`src/markdown/`** - Markdown parsing and serialization
  - **`schema.js`** - ProseMirror schema for markdown documents
  - **`parser.js`** - Markdown to ProseMirror document parser
  - **`serializer.js`** - ProseMirror to markdown serializer

### Key Features

- **Bidirectional Conversion** - Seamless switching between WYSIWYG and markdown modes
- **Modern Architecture** - Built on ProseMirror's immutable document model
- **Rich Editing** - Full ProseMirror editing capabilities with toolbar and shortcuts  
- **Markdown Fidelity** - Preserves markdown structure during conversion
- **Extensible Design** - Plugin-based architecture for custom functionality
- **Performance Optimized** - ESM modules with import maps and modulepreload

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
# Navigate to prosemirror-md directory
cd prosemirror-md

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Build for GitHub Pages
npm run build:gh-pages
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

## Editor Implementation Details

### View Switching Architecture

The `EditorManager` class handles switching between views:

```js
class EditorManager {
    switchToView(mode, content = null) {
        const currentContent = content || this.currentView.getContent();
        this.currentView.destroy();
        
        const ViewClass = mode === 'wysiwyg' ? ProseMirrorView : MarkdownView;
        this.currentView = new ViewClass(this.target, currentContent);
        this.currentView.focus();
    }
}
```

### WYSIWYG View (ProseMirror)

Key implementation patterns:
```js
// Parse markdown into ProseMirror document
const doc = parseMarkdown(content);

// Create editor state with plugins
const state = EditorState.create({
    doc,
    plugins: exampleSetup({ schema: markdownSchema })
});

// Create view with custom dispatch
const view = new EditorView(target, {
    state,
    dispatchTransaction: this.dispatchTransaction.bind(this)
});
```

### Markdown View (Textarea)

Simple textarea implementation with enhancements:
- Auto-resize functionality
- Tab insertion handling
- Keyboard shortcuts
- Proper font and styling

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

## Markdown Conversion

### Parser Configuration

The parser handles all standard markdown elements:
```js
export const markdownParser = MarkdownParser.fromSchema(markdownSchema, {
    blockquote: { block: "blockquote", wrap: true },
    paragraph: { block: "paragraph" },
    heading: { 
        block: "heading",
        getAttrs: (tok) => ({ level: +tok.tag.slice(1) })
    }
    // ... more node mappings
});
```

### Serializer Configuration

The serializer converts back to markdown:
```js
export const markdownSerializer = new MarkdownSerializer({
    heading(state, node) {
        state.write(state.repeat("#", node.attrs.level) + " ");
        state.renderInline(node);
        state.closeBlock(node);
    }
    // ... more node serializers
}, {
    em: { open: "*", close: "*", mixable: true },
    strong: { open: "**", close: "**", mixable: true }
    // ... more mark serializers  
});
```

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

This documentation provides a comprehensive guide to understanding, developing, and extending the ProseMirror markdown editor. The modular architecture and clear separation of concerns make it easy to customize and enhance for specific use cases.