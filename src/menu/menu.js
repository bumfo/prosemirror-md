import { toggleMark, setBlockType, wrapIn } from 'prosemirror-commands';

/**
 * Generic menu system for ProseMirror editors
 * Provides reusable menu components with optimized state management
 * 
 * @fileoverview Core menu classes and utilities
 */

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
export class MenuItem {
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
export function setClass(dom, cls, on) {
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
export function combineUpdates(updates, nodes) {
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
export function renderGrouped(view, content) {
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
export class StateContext {
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

export class MenuView {
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
 * Custom toggle mark command that aligns with our active state logic
 * @param {import('prosemirror-model').MarkType} markType - Mark type to toggle
 * @returns {import('./menu.d.ts').CommandFn} Toggle mark command
 */
export function customToggleMark(markType) {
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
export function markActive(markType) {
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
export function blockActive(nodeType, attrs = {}) {
    return (state, context) => {
        // Use pre-computed context for efficient checking
        return context.isBlockActive(nodeType, attrs);
    };
}

// Menu item utility factories

/**
 * Create menu item for toggling a mark (bold, italic, code, etc.)
 * @param {import('prosemirror-model').MarkType} markType - Mark type to toggle
 * @param {Object} options - Menu item options (icon, title, etc.)
 * @returns {MenuItem} Menu item for mark toggle
 */
export function markItem(markType, options) {
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
export function blockTypeItem(nodeType, options) {
    const { attrs = {}, ...otherOptions } = options;
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
export function wrapItem(nodeType, options) {
    const { attrs = {}, ...otherOptions } = options;
    const command = wrapIn(nodeType, attrs);

    const spec = {
        run: command,
        enable: (state) => command(state), // Check if command is available
        ...otherOptions
    };
    return new MenuItem(spec);
}