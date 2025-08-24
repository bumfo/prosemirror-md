import { Plugin, PluginKey } from 'prosemirror-state';
import { toggleMark, setBlockType, wrapIn, lift, joinUp, selectParentNode } from 'prosemirror-commands';
import { undo, redo } from 'prosemirror-history';
import { wrapInList, splitListItem, liftListItem, sinkListItem } from 'prosemirror-schema-list';
import { keymap } from 'prosemirror-keymap';

/**
 * Custom menu plugin for ProseMirror markdown editing
 * Provides a toolbar with essential markdown formatting options
 */

// Debug mode configuration (set to true to enable debug logging)
const DEBUG_MENU = false;

// Use original class names that match our existing CSS
const prefix = "";

/**
 * Menu element interface - anything that can be rendered in a menu
 * @interface MenuElement
 */

/**
 * Icon specification - supports multiple formats
 * @typedef {Object} IconSpec
 * @property {string} [text] - Text-based icon content
 * @property {string} [css] - Additional CSS for text icons
 * @property {string} [html] - HTML content for the icon (legacy support)
 */

/**
 * Menu item specification object
 * @typedef {Object} MenuItemSpec
 * @property {function} run - Command to execute when clicked
 * @property {function} [enable] - Function to check if item should be enabled
 * @property {function} [active] - Function to check if item should show as active
 * @property {function} [select] - Function to check if item should be visible
 * @property {IconSpec|string} [icon] - Icon specification or HTML string
 * @property {string} [label] - Text label for the item
 * @property {string|function} [title] - Tooltip text (can be function of state)
 * @property {string} [class] - Additional CSS class
 * @property {string} [css] - Additional CSS styles
 */

/**
 * MenuItem class implementing the MenuElement interface
 * Similar to prosemirror-menu's MenuItem but adapted for our needs
 */
class MenuItem {
    /**
     * Create a menu item
     * @param {MenuItemSpec} spec - The menu item specification
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
         * @returns {boolean} True if item should be visible
         */
        function update(state) {
            // Handle visibility (select function)
            if (spec.select) {
                let selected = spec.select(state);
                dom.style.display = selected ? '' : 'none';
                if (!selected) return false;
            }

            // Handle enabled state
            let enabled = true;
            if (spec.enable) {
                enabled = spec.enable(state) || false;
                setClass(dom, 'disabled', !enabled);
            }

            // Handle active state
            if (spec.active) {
                let active = enabled && spec.active(state) || false;
                setClass(dom, 'active', active);
            }

            return true;
        }

        return { dom, update };
    }
}

/**
 * Utility function to toggle CSS classes (IE11 compatible)
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
    return (state) => {
        let something = false;
        for (let i = 0; i < updates.length; i++) {
            let up = updates[i](state);
            nodes[i].style.display = up ? '' : 'none';
            if (up) something = true;
        }
        return something;
    };
}

/**
 * Render grouped menu elements with separators
 * @param {EditorView} view - Editor view
 * @param {Array<Array<MenuElement>>} content - Nested array of menu elements
 * @returns {Object} Object with dom and update function
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

    function update(state) {
        let something = false, needSep = false;
        for (let i = 0; i < updates.length; i++) {
            let hasContent = updates[i](state);
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
        
        // Store last update state to prevent unnecessary updates
        this.lastUpdateState = null;
        
        this.update();
    }
    
    update() {
        // Update immediately for responsive feedback
        this.doUpdate();
    }
    
    doUpdate() {
        const state = this.editorView.state;
        
        // Create a state signature to avoid unnecessary updates
        const stateSignature = this.createStateSignature(state);
        if (DEBUG_MENU) console.log('State signature:', stateSignature);
        if (stateSignature === this.lastUpdateState) {
            if (DEBUG_MENU) console.log('Skipping update - same state signature');
            return; // No need to update
        }
        if (DEBUG_MENU) console.log('Updating menu - new state signature');
        this.lastUpdateState = stateSignature;
        
        // Use the grouped content update function
        this.contentUpdate(state);
    }
    
    createStateSignature(state) {
        const { from, to, empty } = state.selection;
        
        // Include the parent node type for block-level context
        const $from = state.doc.resolve(from);
        const parentType = $from.parent.type.name;
        
        // Include history state for undo/redo button updates
        let historyState = '';
        try {
            // Try to get history state using the history plugin key
            const historyPlugin = state.plugins.find(plugin => {
                return plugin.spec && plugin.spec.key && 
                       (plugin.spec.key === 'history' || plugin.spec.key.key === 'history');
            });
            
            if (historyPlugin) {
                const history = historyPlugin.getState(state);
                if (history && history.done && history.undone) {
                    historyState = `${history.done.length}-${history.undone.length}`;
                }
            } else {
                // Fallback: try to detect history changes by testing undo/redo availability
                const canUndo = undo(state);
                const canRedo = redo(state);
                historyState = `${canUndo ? '1' : '0'}-${canRedo ? '1' : '0'}`;
            }
        } catch (e) {
            if (DEBUG_MENU) console.warn('History state detection failed:', e);
            // Last resort: use document change count as proxy
            historyState = `doc-${state.doc.content.size}`;
        }
        
        if (empty) {
            // For collapsed selections, track both stored marks and position marks
            let markTypes;
            if (state.storedMarks) {
                markTypes = state.storedMarks.map(mark => mark.type.name).sort().join(',');
            } else {
                markTypes = $from.marks().map(mark => mark.type.name).sort().join(',');
            }
            return `collapsed-${parentType}-${markTypes}-${historyState}`;
        } else {
            // For selections, track marks that are present throughout the ENTIRE selection
            const markTypes = new Set();
            let firstTextNode = true;
            
            state.doc.nodesBetween(from, to, (node) => {
                if (node.isText && node.text.length > 0) {
                    const nodeMarkTypes = new Set(node.marks.map(mark => mark.type.name));
                    
                    if (firstTextNode) {
                        // Initialize with marks from first text node
                        nodeMarkTypes.forEach(markType => markTypes.add(markType));
                        firstTextNode = false;
                    } else {
                        // Keep only marks that exist in ALL text nodes (intersection)
                        for (let markType of markTypes) {
                            if (!nodeMarkTypes.has(markType)) {
                                markTypes.delete(markType);
                            }
                        }
                    }
                }
            });
            
            const marksSignature = Array.from(markTypes).sort().join(',');
            
            return `${from}-${to}-${marksSignature}-${parentType}-${historyState}`;
        }
    }
    
    destroy() {
        this.dom.remove();
    }
}

/**
 * Helper function to create menu items with keyboard shortcuts
 * @param {IconSpec|string} icon - Icon specification or HTML string
 * @param {string} title - Item title
 * @param {function} command - Command function
 * @param {function|null} [isActive] - Active state function
 * @param {string|null} [shortcut] - Keyboard shortcut
 * @param {function|null} [isEnabled] - Enable state function
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

// Custom toggle mark command that aligns with our active state logic
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

// Helper function to check if a mark is active
function markActive(markType) {
    // Capture markType in closure to avoid reference issues
    const type = markType;
    return (state) => {
        const { from, to, empty } = state.selection;
        
        if (empty) {
            // For collapsed selections, check both stored marks and position marks
            const $from = state.doc.resolve(from);
            if (state.storedMarks) {
                // Explicitly stored marks exist (user toggled something)
                return !!type.isInSet(state.storedMarks);
            } else {
                // No explicit stored marks, check position marks
                return !!type.isInSet($from.marks());
            }
        }
        
        // For non-empty selections, only show active if the ENTIRE selection has the mark
        // This prioritizes applying marks over removing them
        let allTextHasMark = true;
        let hasAnyText = false;
        
        state.doc.nodesBetween(from, to, (node, pos) => {
            if (node.isText && node.text.length > 0) {
                hasAnyText = true;
                const nodeStart = Math.max(pos, from);
                const nodeEnd = Math.min(pos + node.nodeSize, to);
                
                // Check if this text node has the mark for the selected portion
                if (!type.isInSet(node.marks)) {
                    allTextHasMark = false;
                    return false; // Stop iteration
                }
            }
        });
        
        // Only show active if selection has text and ALL of it has the mark
        return hasAnyText && allTextHasMark;
    };
}

// Helper function to check if a block type is active
function blockActive(nodeType, attrs = {}) {
    return (state) => {
        const { $from, to, node } = state.selection;
        if (node) return node.hasMarkup(nodeType, attrs);
        return to <= $from.end() && $from.parent.hasMarkup(nodeType, attrs);
    };
}

// Helper function to prompt for link URL
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

// Create menu items
export function createMenuItems(schema) {
    return [
        // Text formatting group
        [
            menuItem(
                '<strong>B</strong>',
                'Bold',
                customToggleMark(schema.marks.strong),
                markActive(schema.marks.strong),
                'Mod-b'
            ),
            menuItem(
                '<em>I</em>',
                'Italic',
                customToggleMark(schema.marks.em),
                markActive(schema.marks.em),
                'Mod-i'
            ),
            menuItem(
                '<code>`</code>',
                'Code',
                customToggleMark(schema.marks.code),
                markActive(schema.marks.code),
                'Mod-`'
            ),
            menuItem(
                '🔗',
                'Link',
                linkCommand(schema.marks.link),
                markActive(schema.marks.link),
                'Mod-k'
            )
        ],
        
        // Block types group
        [
            menuItem(
                '¶',
                'Paragraph',
                setBlockType(schema.nodes.paragraph),
                blockActive(schema.nodes.paragraph),
                'Mod-Alt-0'
            ),
            menuItem(
                '<strong>H1</strong>',
                'Heading 1',
                setBlockType(schema.nodes.heading, { level: 1 }),
                blockActive(schema.nodes.heading, { level: 1 }),
                'Mod-Alt-1'
            ),
            menuItem(
                '<strong>H2</strong>',
                'Heading 2',
                setBlockType(schema.nodes.heading, { level: 2 }),
                blockActive(schema.nodes.heading, { level: 2 }),
                'Mod-Alt-2'
            ),
            menuItem(
                '<strong>H3</strong>',
                'Heading 3',
                setBlockType(schema.nodes.heading, { level: 3 }),
                blockActive(schema.nodes.heading, { level: 3 }),
                'Mod-Alt-3'
            ),
            menuItem(
                '</>',
                'Code block',
                setBlockType(schema.nodes.code_block)
            )
        ],
        
        // Block wrappers group
        [
            menuItem(
                '"',
                'Blockquote',
                wrapIn(schema.nodes.blockquote)
            ),
            menuItem(
                '•',
                'Bullet list',
                wrapInList(schema.nodes.bullet_list)
            ),
            menuItem(
                '1.',
                'Ordered list',
                wrapInList(schema.nodes.ordered_list)
            )
        ],
        
        // Actions group
        [
            menuItem(
                'undo',
                'Undo',
                undo,
                null,
                'Mod-z',
                state => {
                    const canUndo = undo(state);
                    if (DEBUG_MENU) console.log('Undo enable check:', canUndo);
                    return canUndo;
                }
            ),
            menuItem(
                'redo',
                'Redo',
                redo,
                null,
                'Mod-Shift-z',
                state => {
                    const canRedo = redo(state);
                    if (DEBUG_MENU) console.log('Redo enable check:', canRedo);
                    return canRedo;
                }
            ),
            menuItem(
                'horizontalRule',
                'Horizontal rule',
                (state, dispatch) => {
                    if (dispatch) {
                        const { tr } = state;
                        const node = schema.nodes.horizontal_rule.create();
                        dispatch(tr.replaceSelectionWith(node));
                    }
                    return true;
                }
            ),
            menuItem(
                'image',
                'Insert image',
                insertImageCommand(schema)
            ),
            menuItem(
                { text: '⌃⏎', css: 'font-size: 12px;' },
                'Hard break',
                insertHardBreakCommand(schema),
                null,
                'Shift-Enter'
            ),
            menuItem(
                { text: '∅', css: 'font-weight: bold;' },
                'Clear formatting',
                clearFormattingCommand(schema),
                null,
                'Mod-\\'
            ),
            menuItem(
                { text: '⊞', css: 'font-weight: bold;' },
                'Insert table',
                insertTableCommand(schema)
            )
        ]
    ];
}

// Image insertion command
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

// Hard break command (Shift+Enter)
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

// Clear formatting command
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

// Insert table command (basic 3x3 table)
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

// Create keyboard shortcuts map
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

// Create the menu plugin
export function menuPlugin(schema) {
    const menuItems = createMenuItems(schema);
    
    return new Plugin({
        key: new PluginKey('menu'),
        view(editorView) {
            const menuView = new MenuView(menuItems, editorView);
            
            // Insert menu before editor
            editorView.dom.parentNode.insertBefore(menuView.dom, editorView.dom);
            
            return menuView;
        }
    });
}