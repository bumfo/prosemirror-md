import { Plugin, PluginKey } from 'prosemirror-state';
import { toggleMark, setBlockType, wrapIn } from 'prosemirror-commands';
import { undo, redo } from 'prosemirror-history';
import { wrapInList, splitListItem, liftListItem, sinkListItem } from 'prosemirror-schema-list';
import { keymap } from 'prosemirror-keymap';
import { icons } from './icons.js';

/**
 * Custom menu plugin for ProseMirror markdown editing
 * Provides a toolbar with essential markdown formatting options
 *
 * @fileoverview Custom menu system with optimized state management
 * See menu.d.ts for complete type definitions
 */

// Debug mode configuration
const DEBUG_MENU = false;

/**
 * @typedef {import('prosemirror-view').EditorView} EditorView
 * @typedef {import('prosemirror-state').EditorState} EditorState
 * @typedef {import('./menu.d.ts').MenuItem} MenuItem
 * @typedef {import('./menu.d.ts').IconSpec} IconSpec
 * @typedef {import('./menu.d.ts').MenuItemSpec} MenuItemSpec
 * @typedef {import('./menu.d.ts').CommandFn} CommandFn
 * @typedef {import('./menu.d.ts').ActiveFn} ActiveFn
 * @typedef {import('./menu.d.ts').EnableFn} EnableFn
 * @typedef {import('./menu.d.ts').StateContext} StateContext
 */


/**
 * MenuItem class with optimized state checking via StateContext
 */
class MenuItem {
    /**
     * @param {MenuItemSpec} spec - Menu item specification
     */
    constructor(spec) {
        this.spec = spec;
    }

    /**
     * Render the menu item into DOM
     * @param {EditorView} view - The editor view
     * @returns {Object} Object with dom and update function
     */
    render(view) {
        let spec = this.spec;
        let dom;

        // Create DOM element based on icon specification
        if (spec.icon) {
            if (typeof spec.icon === 'string') {
                // Legacy HTML string support
                dom = document.createElement('button');
                dom.innerHTML = spec.icon;
            } else if (spec.icon.html) {
                // HTML icon spec
                dom = document.createElement('button');
                dom.innerHTML = spec.icon.html;
            } else if (spec.icon.text) {
                // Text icon spec
                dom = document.createElement('button');
                dom.textContent = spec.icon.text;
                if (spec.icon.css) {
                    dom.style.cssText += spec.icon.css;
                }
            }
        } else if (spec.label) {
            // Text label
            dom = document.createElement('button');
            dom.textContent = spec.label;
        }

        if (!dom) throw new RangeError('MenuItem without icon or label property');

        dom.className = 'menu-item';
        dom.type = 'button';

        // Set title/tooltip
        if (spec.title) {
            const title = typeof spec.title === 'function' ? spec.title(view.state) : spec.title;
            dom.setAttribute('title', title);
        }

        // Apply additional styling
        if (spec.class) dom.classList.add(spec.class);
        if (spec.css) dom.style.cssText += spec.css;

        // Handle click events
        dom.addEventListener('mousedown', e => {
            e.preventDefault();
            // Focus the editor
            view.focus();
            // Check if disabled by looking at the wrapper span that will be added later
            // For now, just run the command and let it handle its own availability
            spec.run(view.state, view.dispatch, view, e);
        });

        /**
         * Update function called on state changes
         * @param {EditorState} state - Current editor state
         * @param {StateContext} context - Pre-computed state context
         * @returns {boolean} True if item should be visible
         */
        // Cache for last states to avoid unnecessary DOM updates
        let lastVisible = null;
        let lastEnabled = null;
        let lastActive = null;
        
        function update(state, context) {
            // Handle visibility (select function)
            let visible = true;
            if (spec.select) {
                visible = spec.select(state, context);
                if (visible !== lastVisible) {
                    dom.style.display = visible ? '' : 'none';
                    lastVisible = visible;
                }
                if (!visible) return false;
            }

            // Handle enabled state
            let enabled = true;
            if (spec.enable) {
                enabled = spec.enable(state, context) || false;
                if (enabled !== lastEnabled) {
                    setClass(dom, 'disabled', !enabled);
                    lastEnabled = enabled;
                }
            }

            // Handle active state
            if (spec.active) {
                let active = enabled && spec.active(state, context) || false;
                if (active !== lastActive) {
                    setClass(dom, 'active', active);
                    lastActive = active;
                }
            }

            return visible;
        }

        return { dom, update };
    }
}

/**
 * Toggle CSS classes
 * @param {HTMLElement} dom - DOM element
 * @param {string} cls - CSS class name
 * @param {boolean} on - Whether to add or remove class
 */
function setClass(dom, cls, on) {
    if (on) {
        dom.classList.add(cls);
    } else {
        dom.classList.remove(cls);
    }
}

/**
 * Combine multiple update functions into one
 * @param {Array<function>} updates - Array of update functions
 * @param {Array<HTMLElement>} nodes - Array of corresponding DOM nodes
 * @returns {function} Combined update function
 */
function combineUpdates(updates, nodes) {
    return (state, context) => {
        let something = false;
        for (let i = 0; i < updates.length; i++) {
            let up = updates[i](state, context);
            nodes[i].style.display = up ? '' : 'none';
            if (up) something = true;
        }
        return something;
    };
}

/**
 * Render grouped menu elements with separators
 * @param {import('prosemirror-view').EditorView} view - Editor view
 * @param {MenuItem[][]} content - Nested array of menu elements
 * @returns {import('./menu.d.ts').RenderedGroup} Object with dom and update function
 */
function renderGrouped(view, content) {
    let result = document.createDocumentFragment();
    let updates = [], separators = [];

    for (let i = 0; i < content.length; i++) {
        // Add separator between groups (like original implementation)
        if (i > 0) {
            let separator = document.createElement('div');
            separator.className = 'menu-separator';
            separators.push(separator);
            result.appendChild(separator);
        }

        // Create group container (restore original menu-group)
        let groupEl = document.createElement('div');
        groupEl.className = 'menu-group';
        
        let items = content[i], localUpdates = [], localNodes = [];
        
        for (let j = 0; j < items.length; j++) {
            let { dom, update } = items[j].render(view);
            groupEl.appendChild(dom); // Add directly to group, no wrapper spans
            localNodes.push(dom);
            localUpdates.push(update);
        }

        result.appendChild(groupEl);

        if (localUpdates.length) {
            updates.push(combineUpdates(localUpdates, localNodes));
        }
    }

    function update(state, context) {
        let something = false, needSep = false;
        for (let i = 0; i < updates.length; i++) {
            let hasContent = updates[i](state, context);
            if (i && separators[i - 1]) {
                separators[i - 1].style.display = needSep && hasContent ? '' : 'none';
            }
            needSep = hasContent;
            if (hasContent) something = true;
        }
        return something;
    }

    return { dom: result, update };
}

/**
 * Pre-computes expensive state operations to avoid redundant computation
 * @implements {import('./menu.d.ts').StateContext}
 */
class StateContext {
    constructor(state) {
        const { from, to, empty, node } = state.selection;
        
        // Pre-compute position resolvers
        this.$from = state.doc.resolve(from);
        this.$to = state.doc.resolve(to);
        
        // Pre-compute block information
        this.parentNode = this.$from.parent;
        this.parentType = this.parentNode.type;
        this.parentAttrs = this.parentNode.attrs || {};
        this.nodeSelection = node;
        this.selectionAtBlockEnd = to <= this.$from.end();
        
        // Pre-compute mark information
        if (empty) {
            this.marksAtPosition = state.storedMarks || this.$from.marks();
            this.selectionMarks = null;
        } else {
            this.marksAtPosition = null;
            this.selectionMarks = this.computeSelectionMarks(state, from, to);
        }
        
        // Cache other commonly needed values
        this.empty = empty;
        this.from = from;
        this.to = to;
        this.state = state;
    }
    
    computeSelectionMarks(state, from, to) {
        // Compute marks present throughout entire selection ONCE
        const marks = [];
        let firstTextNode = true;
        let hasAnyText = false;
        
        state.doc.nodesBetween(from, to, (node) => {
            if (node.isText && node.text.length > 0) {
                hasAnyText = true;
                if (firstTextNode) {
                    marks.push(...node.marks);
                    firstTextNode = false;
                } else {
                    // Keep only marks present in all text nodes
                    for (let i = marks.length - 1; i >= 0; i--) {
                        if (!marks[i].isInSet(node.marks)) {
                            marks.splice(i, 1);
                        }
                    }
                }
            }
        });
        
        return hasAnyText ? marks : [];
    }
    
    // Efficient mark checking using pre-computed data
    isMarkActive(markType) {
        if (this.empty) {
            return !!markType.isInSet(this.marksAtPosition);
        } else {
            return !!markType.isInSet(this.selectionMarks);
        }
    }
    
    // Efficient block checking using pre-computed data  
    isBlockActive(nodeType, attrs = {}) {
        if (this.nodeSelection) {
            return this.nodeSelection.hasMarkup(nodeType, attrs);
        }
        return this.selectionAtBlockEnd && this.parentNode.hasMarkup(nodeType, attrs);
    }
}

class MenuView {
    constructor(items, editorView) {
        this.items = items;
        this.editorView = editorView;
        
        // Create menu DOM element
        this.dom = document.createElement('div');
        this.dom.className = 'prosemirror-menu';
        
        // Render grouped items
        let { dom: contentDom, update: contentUpdate } = renderGrouped(editorView, items);
        this.contentUpdate = contentUpdate;
        this.dom.appendChild(contentDom);
        
        // Menu items handle their own clicks now
        
        this.update();
    }
    
    update() {
        // Create StateContext once with all pre-computed expensive operations
        const state = this.editorView.state;
        const context = new StateContext(state);
        
        // Pass both state and context to all menu items
        this.contentUpdate(state, context);
    }
    
    destroy() {
        this.dom.remove();
    }
}

/**
 * Create menu item with keyboard shortcut
 * @param {IconSpec|string} icon - Icon specification or HTML string
 * @param {string} title - Item title
 * @param {CommandFn} command - Command function
 * @param {ActiveFn|null} [isActive] - Active state function
 * @param {string|null} [shortcut] - Keyboard shortcut
 * @param {EnableFn|null} [isEnabled] - Enable state function
 * @returns {MenuItem} Menu item instance
 */
function menuItem(icon, title, command, isActive = null, shortcut = null, isEnabled = null) {
    // Build title with optional keyboard shortcut
    let fullTitle = title;
    if (shortcut) {
        // Format shortcut for display (Mod = Cmd/Ctrl)
        const displayShortcut = shortcut.replace('Mod', navigator.platform.includes('Mac') ? '⌘' : 'Ctrl');
        fullTitle = `${title} (${displayShortcut})`;
    }

    // Convert icon to proper spec format
    let iconSpec;
    if (typeof icon === 'string') {
        iconSpec = { html: icon };
    } else if (typeof icon === 'object' && icon.text) {
        iconSpec = icon;
    } else {
        iconSpec = icon;
    }

    const spec = {
        run: command,
        icon: iconSpec,
        title: fullTitle
    };

    // Add optional functions if provided
    if (isActive) spec.active = isActive;
    if (isEnabled) spec.enable = isEnabled;

    return new MenuItem(spec);
}

/**
 * Custom toggle mark command that aligns with our active state logic
 * @param {import('prosemirror-model').MarkType} markType - Mark type to toggle
 * @returns {import('./menu.d.ts').CommandFn} Toggle mark command
 */
function customToggleMark(markType) {
    return (state, dispatch, view) => {
        const { from, to, empty } = state.selection;
        
        if (empty) {
            // For collapsed cursor, use standard toggleMark behavior
            return toggleMark(markType)(state, dispatch, view);
        }
        
        // For selections, check if ENTIRE selection has the mark
        let allTextHasMark = true;
        let hasAnyText = false;
        
        state.doc.nodesBetween(from, to, (node, pos) => {
            if (node.isText && node.text.length > 0) {
                hasAnyText = true;
                if (!markType.isInSet(node.marks)) {
                    allTextHasMark = false;
                    return false; // Stop iteration
                }
            }
        });
        
        if (!hasAnyText) return false;
        
        if (!dispatch) return true; // Just checking if command is available
        
        let tr = state.tr;
        
        if (allTextHasMark) {
            // All text has the mark -> remove it
            tr = tr.removeMark(from, to, markType);
        } else {
            // Not all text has the mark -> apply it to entire selection
            tr = tr.addMark(from, to, markType.create());
        }
        
        dispatch(tr);
        return true;
    };
}

/**
 * Context-aware helper function to check if a mark is active
 * @param {import('prosemirror-model').MarkType} markType - Mark type to check
 * @returns {import('./menu.d.ts').ActiveFn} Active state function
 */
function markActive(markType) {
    // Capture markType in closure to avoid reference issues
    const type = markType;
    return (state, context) => {
        // Use pre-computed context for efficient checking
        return context.isMarkActive(type);
    };
}

/**
 * Context-aware helper function to check if a block type is active
 * @param {import('prosemirror-model').NodeType} nodeType - Node type to check
 * @param {Object} [attrs={}] - Optional attributes to match
 * @returns {import('./menu.d.ts').ActiveFn} Active state function
 */
function blockActive(nodeType, attrs = {}) {
    return (state, context) => {
        // Use pre-computed context for efficient checking
        return context.isBlockActive(nodeType, attrs);
    };
}

/**
 * Helper function to prompt for link URL
 * @param {import('prosemirror-model').MarkType} markType - Link mark type
 * @returns {import('./menu.d.ts').CommandFn} Link command function
 */
function linkCommand(markType) {
    return (state, dispatch, view) => {
        if (state.selection.empty) return false;
        
        // If dispatch is null, we're just checking if command is available
        if (!dispatch) return true;
        
        const { from, to } = state.selection;
        const start = state.doc.resolve(from);
        const end = state.doc.resolve(to);
        
        // Check if selection already has a link
        const mark = markType.isInSet(start.marks());
        let href = '';
        
        if (mark) {
            href = mark.attrs.href;
        }
        
        const url = prompt('Enter URL:', href);
        if (url === null) return true; // User cancelled
        
        if (url === '') {
            // Remove link
            dispatch(state.tr.removeMark(from, to, markType));
        } else {
            // Add/update link
            dispatch(state.tr.addMark(from, to, markType.create({ href: url })));
        }
        
        return true;
    };
}

// Menu item utility factories

/**
 * Create menu item for toggling a mark (bold, italic, code, etc.)
 * @param {import('prosemirror-model').MarkType} markType - Mark type to toggle
 * @param {Object} options - Menu item options (icon, title, etc.)
 * @returns {MenuItem} Menu item for mark toggle
 */
function markItem(markType, options) {
    const spec = {
        run: customToggleMark(markType),
        active: markActive(markType),
        enable: (state) => customToggleMark(markType)(state), // Check if command is available
        ...options
    };
    return new MenuItem(spec);
}

/**
 * Create menu item for setting block type (paragraph, headings, etc.)
 * @param {import('prosemirror-model').NodeType} nodeType - Node type to set
 * @param {Object} options - Menu item options (attrs, icon, title, etc.)
 * @returns {MenuItem} Menu item for block type
 */
function blockTypeItem(nodeType, options) {
    const {attrs = {}, ...otherOptions} = options;
    const command = setBlockType(nodeType, attrs);

    const spec = {
        run: command,
        active: blockActive(nodeType, attrs),
        enable: (state) => command(state), // Check if command is available
        ...otherOptions
    };
    return new MenuItem(spec);
}

/**
 * Create menu item for wrapping selection in a node (blockquote, lists)
 * @param {import('prosemirror-model').NodeType} nodeType - Node type to wrap with
 * @param {Object} options - Menu item options (attrs, icon, title, etc.)
 * @returns {MenuItem} Menu item for wrapping
 */
function wrapItem(nodeType, options) {
    const {attrs = {}, ...otherOptions} = options;
    const command = wrapIn(nodeType, attrs);

    const spec = {
        run: command,
        enable: (state) => command(state), // Check if command is available
        ...otherOptions
    };
    return new MenuItem(spec);
}

/**
 * Create menu items for a given schema
 * @param {import('prosemirror-model').Schema} schema - ProseMirror schema
 * @returns {MenuItem[][]} Grouped menu items
 */
export function createMenuItems(schema) {
    return [
        // Text formatting group
        [
            markItem(schema.marks.strong, {
                icon: icons.bold,
                title: 'Bold (Mod-b)'
            }),
            markItem(schema.marks.em, {
                icon: icons.itallic,
                title: 'Italic (Mod-i)'
            }),
            markItem(schema.marks.code, {
                icon: icons.code,
                title: 'Code (Mod-`)'
            }),
            new MenuItem({
                icon: icons.link,
                title: 'Link (Mod-k)',
                run: linkCommand(schema.marks.link),
                active: markActive(schema.marks.link)
            })
        ],

        // Block types group
        [
            blockTypeItem(schema.nodes.paragraph, {
                icon: icons.paragraph,
                title: 'Paragraph (Mod-Alt-0)'
            }),
            blockTypeItem(schema.nodes.heading, {
                attrs: { level: 1 },
                icon: icons.h1,
                title: 'Heading 1 (Mod-Alt-1)'
            }),
            blockTypeItem(schema.nodes.heading, {
                attrs: { level: 2 },
                icon: icons.h2,
                title: 'Heading 2 (Mod-Alt-2)'
            }),
            blockTypeItem(schema.nodes.heading, {
                attrs: { level: 3 },
                icon: icons.h3,
                title: 'Heading 3 (Mod-Alt-3)'
            }),
            blockTypeItem(schema.nodes.code_block, {
                icon: icons.code_block,
                title: 'Code block'
            })
        ],

        // Block wrappers group
        [
            wrapItem(schema.nodes.blockquote, {
                icon: icons.blockquote,
                title: 'Blockquote'
            }),
            new MenuItem({
                icon: icons.bullet_list,
                title: 'Bullet list',
                run: wrapInList(schema.nodes.bullet_list),
                enable: (state) => wrapInList(schema.nodes.bullet_list)(state)
            }),
            new MenuItem({
                icon: icons.ordered_list,
                title: 'Ordered list',
                run: wrapInList(schema.nodes.ordered_list),
                enable: (state) => wrapInList(schema.nodes.ordered_list)(state)
            })
        ],

        // Actions group
        [
            new MenuItem({
                icon: icons.undo,
                title: 'Undo (Mod-z)',
                run: undo,
                enable: (state) => {
                    const canUndo = undo(state);
                    if (DEBUG_MENU) console.log('Undo enable check:', canUndo);
                    return canUndo;
                }
            }),
            new MenuItem({
                icon: icons.redo,
                title: 'Redo (Mod-Shift-z)',
                run: redo,
                enable: (state) => {
                    const canRedo = redo(state);
                    if (DEBUG_MENU) console.log('Redo enable check:', canRedo);
                    return canRedo;
                }
            }),
            new MenuItem({
                icon: icons.h_rule,
                title: 'Horizontal rule',
                run: (state, dispatch) => {
                    if (dispatch) {
                        const {tr} = state;
                        const node = schema.nodes.horizontal_rule.create();
                        dispatch(tr.replaceSelectionWith(node));
                    }
                    return true;
                }
            }),
            new MenuItem({
                icon: icons.image,
                title: 'Insert image',
                run: insertImageCommand(schema)
            }),
            new MenuItem({
                icon: icons.hard_break,
                title: 'Hard break (Shift-Enter)',
                run: insertHardBreakCommand(schema)
            }),
            new MenuItem({
                icon: icons.clear_formatting,
                title: 'Clear formatting (Mod-\\)',
                run: clearFormattingCommand(schema)
            }),
            new MenuItem({
                icon: icons.table,
                title: 'Insert table',
                run: insertTableCommand(schema)
            })
        ]
    ];
}

/**
 * Image insertion command
 * @param {import('prosemirror-model').Schema} schema - ProseMirror schema
 * @returns {import('./menu.d.ts').CommandFn} Image insertion command
 */
function insertImageCommand(schema) {
    return (state, dispatch) => {
        // If dispatch is null, we're just checking if command is available
        if (!dispatch) return true;
        
        const url = prompt('Enter image URL:', 'https://');
        if (url === null) return true; // User cancelled
        
        if (url) {
            const node = schema.nodes.image ? 
                schema.nodes.image.create({ src: url }) :
                schema.text(`![Image](${url})`);
            dispatch(state.tr.replaceSelectionWith(node));
        }
        return true;
    };
}

/**
 * Hard break command (Shift+Enter)
 * @param {import('prosemirror-model').Schema} schema - ProseMirror schema
 * @returns {import('./menu.d.ts').CommandFn} Hard break command
 */
function insertHardBreakCommand(schema) {
    return (state, dispatch) => {
        const { $from, $to } = state.selection;
        if ($from.parent.type.spec.code) return false; // Don't insert in code blocks
        if (!dispatch) return true; // Just checking availability
        
        if (schema.nodes.hard_break) {
            dispatch(state.tr.replaceWith($from.pos, $to.pos, schema.nodes.hard_break.create()));
        }
        return true;
    };
}

/**
 * Clear formatting command
 * @param {import('prosemirror-model').Schema} schema - ProseMirror schema
 * @returns {import('./menu.d.ts').CommandFn} Clear formatting command
 */
function clearFormattingCommand(schema) {
    return (state, dispatch) => {
        const { from, to } = state.selection;
        if (from === to) return false;
        if (!dispatch) return true; // Just checking availability
        
        let tr = state.tr;
        // Remove all marks from selection
        state.doc.nodesBetween(from, to, (node, pos) => {
            if (node.marks.length) {
                const start = Math.max(pos, from);
                const end = Math.min(pos + node.nodeSize, to);
                node.marks.forEach(mark => {
                    tr = tr.removeMark(start, end, mark);
                });
            }
        });
        dispatch(tr);
        return true;
    };
}

/**
 * Insert table command (basic 3x3 table)
 * @param {import('prosemirror-model').Schema} schema - ProseMirror schema
 * @returns {import('./menu.d.ts').CommandFn} Table insertion command
 */
function insertTableCommand(schema) {
    return (state, dispatch) => {
        if (!dispatch) return true; // Just checking availability
        
        // Simple table as markdown text since basic schema doesn't support tables
        const tableText = '| Header 1 | Header 2 | Header 3 |\n|----------|----------|----------|\n| Cell 1   | Cell 2   | Cell 3   |\n| Cell 4   | Cell 5   | Cell 6   |\n\n';
        const node = schema.text(tableText);
        dispatch(state.tr.replaceSelectionWith(node));
        return true;
    };
}

/**
 * Create keyboard shortcuts map
 * @param {import('prosemirror-model').Schema} schema - ProseMirror schema
 * @returns {import('prosemirror-keymap').Keymap} Keymap plugin
 */
export function createKeymap(schema) {
    const keys = {};
    
    // Text formatting
    keys['Mod-b'] = customToggleMark(schema.marks.strong);
    keys['Mod-i'] = customToggleMark(schema.marks.em);
    keys['Mod-`'] = customToggleMark(schema.marks.code);
    keys['Mod-k'] = linkCommand(schema.marks.link);
    
    // Block types
    keys['Mod-Alt-0'] = setBlockType(schema.nodes.paragraph);
    keys['Mod-Alt-1'] = setBlockType(schema.nodes.heading, { level: 1 });
    keys['Mod-Alt-2'] = setBlockType(schema.nodes.heading, { level: 2 });
    keys['Mod-Alt-3'] = setBlockType(schema.nodes.heading, { level: 3 });
    keys['Mod-Alt-4'] = setBlockType(schema.nodes.heading, { level: 4 });
    keys['Mod-Alt-5'] = setBlockType(schema.nodes.heading, { level: 5 });
    keys['Mod-Alt-6'] = setBlockType(schema.nodes.heading, { level: 6 });
    
    // Lists and wrappers
    keys['Mod-Shift-8'] = wrapInList(schema.nodes.bullet_list);
    keys['Mod-Shift-7'] = wrapInList(schema.nodes.ordered_list);
    keys['Mod-Shift-.'] = wrapIn(schema.nodes.blockquote);
    
    // History
    keys['Mod-z'] = undo;
    keys['Mod-Shift-z'] = redo;
    keys['Mod-y'] = redo; // Alternative redo
    
    // List operations
    keys['Enter'] = splitListItem(schema.nodes.list_item);
    keys['Tab'] = sinkListItem(schema.nodes.list_item);
    keys['Shift-Tab'] = liftListItem(schema.nodes.list_item);
    
    // Advanced commands
    keys['Shift-Enter'] = insertHardBreakCommand(schema);
    keys['Mod-\\'] = clearFormattingCommand(schema);
    
    return keymap(keys);
}

/**
 * Create the menu plugin
 * @param {import('prosemirror-model').Schema} schema - ProseMirror schema
 * @returns {import('prosemirror-state').Plugin} Menu plugin
 */
export function menuPlugin(schema) {
    const menuItems = createMenuItems(schema);
    
    return new Plugin({
        key: new PluginKey('menu'),
        view(editorView) {
            const menuView = new MenuView(menuItems, editorView);
            
            // Insert menu before editor
            editorView.dom.parentNode.insertBefore(menuView.dom, editorView.dom);
            
            // Return the view object with update and destroy methods
            return {
                update(view, prevState) {
                    // Update menu on every state change
                    // ProseMirror already optimizes when this is called
                    menuView.update();
                },
                destroy() {
                    menuView.destroy();
                }
            };
        }
    });
}