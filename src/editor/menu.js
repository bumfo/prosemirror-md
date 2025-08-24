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
                '<svg width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">\n' +
                '<path d="M5 12.5647H13.5C15.9853 12.5647 18 10.55 18 8.0647C18 5.57942 15.9853 3.5647 13.5 3.5647H5V12.5647ZM5 12.5647H15.5C17.9853 12.5647 20 14.5794 20 17.0647C20 19.55 17.9853 21.5647 15.5 21.5647H5V12.5647Z" stroke="black" stroke-width="2" stroke-linejoin="round"/>\n' +
                '</svg>',
                'Bold',
                customToggleMark(schema.marks.strong),
                markActive(schema.marks.strong),
                'Mod-b'
            ),
            menuItem(
                '<svg width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">\n' +
                '<path d="M9 3.5647H14M14 3.5647H18M14 3.5647L10 21.5647M10 21.5647H6M10 21.5647H15" stroke="black" stroke-width="2" stroke-linejoin="round"/>\n' +
                '</svg>',
                'Italic',
                customToggleMark(schema.marks.em),
                markActive(schema.marks.em),
                'Mod-i'
            ),
            menuItem(
                '<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 6L4 10l4 4M12 6l4 4-4 4"/></svg>',
                'Code',
                customToggleMark(schema.marks.code),
                markActive(schema.marks.code),
                'Mod-`'
            ),
            menuItem(
                '<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 11L12 7M4 11L8 7"/><circle cx="4" cy="11" r="1.5"/><circle cx="12" cy="7" r="1.5"/></svg>',
                'Link',
                linkCommand(schema.marks.link),
                markActive(schema.marks.link),
                'Mod-k'
            )
        ],
        
        // Block types group
        [
            menuItem(
                '<svg width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">\n' +
                '<path d="M3 7.5647V3.5647H21V7.5647M12 3.5647V21.5647M12 21.5647H7M12 21.5647H17" stroke="black" stroke-width="2" stroke-linejoin="round"/>\n' +
                '</svg>',
                'Paragraph',
                setBlockType(schema.nodes.paragraph),
                blockActive(schema.nodes.paragraph),
                'Mod-Alt-0'
            ),
            menuItem(
                '<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="4" y1="4" x2="4" y2="16"/><line x1="4" y1="10" x2="9" y2="10"/><line x1="9" y1="4" x2="9" y2="16"/><line x1="12" y1="16" x2="16" y2="16"/><line x1="14" y1="4" x2="14" y2="16"/></svg>',
                'Heading 1',
                setBlockType(schema.nodes.heading, { level: 1 }),
                blockActive(schema.nodes.heading, { level: 1 }),
                'Mod-Alt-1'
            ),
            menuItem(
                '<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="4" y1="4" x2="4" y2="16"/><line x1="4" y1="10" x2="9" y2="10"/><line x1="9" y1="4" x2="9" y2="16"/><path d="M12 6a2 2 0 0 1 4 0c0 1.5-2 2.5-4 4v2h4"/></svg>',
                'Heading 2',
                setBlockType(schema.nodes.heading, { level: 2 }),
                blockActive(schema.nodes.heading, { level: 2 }),
                'Mod-Alt-2'
            ),
            menuItem(
                '<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="4" y1="4" x2="4" y2="16"/><line x1="4" y1="10" x2="9" y2="10"/><line x1="9" y1="4" x2="9" y2="16"/><path d="M12 6h4l-2 3 2 3h-4M14 9h2"/></svg>',
                'Heading 3',
                setBlockType(schema.nodes.heading, { level: 3 }),
                blockActive(schema.nodes.heading, { level: 3 }),
                'Mod-Alt-3'
            ),
            menuItem(
                '<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M8 4a2 2 0 0 0-2 2v2a2 2 0 0 1-2 2 2 2 0 0 1 2 2v2a2 2 0 0 0 2 2M12 4a2 2 0 0 1 2 2v2a2 2 0 0 0 2 2 2 2 0 0 0-2 2v2a2 2 0 0 1-2 2"/></svg>',
                'Code block',
                setBlockType(schema.nodes.code_block)
            )
        ],
        
        // Block wrappers group
        [
            menuItem(
                '<svg width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">\n' +
                '<path d="M5.64833 18.808L5.37361 17.8465L5.64833 18.808ZM9.66294 11.6758L8.83147 11.1203L9.66294 11.6758ZM9.11114 12.2276L8.55557 11.3962L9.11114 12.2276ZM9.11114 5.90176L8.55557 6.73323L9.11114 5.90176ZM9.66294 6.45356L8.83147 7.00913L9.66294 6.45356ZM2.33706 6.45356L3.16853 7.00913L2.33706 6.45356ZM2.88886 5.90176L3.44443 6.73323L2.88886 5.90176ZM2.33706 11.6758L3.16853 11.1203L2.33706 11.6758ZM2.88886 12.2276L3.44443 11.3962L2.88886 12.2276ZM17.6483 18.808L17.3736 17.8465L17.6483 18.808ZM21.6629 11.6758L20.8315 11.1203L21.6629 11.6758ZM21.1111 12.2276L20.5556 11.3962L21.1111 12.2276ZM21.1111 5.90176L20.5556 6.73323L21.1111 5.90176ZM21.6629 6.45356L20.8315 7.00913L21.6629 6.45356ZM14.3371 6.45356L15.1685 7.00913L14.3371 6.45356ZM14.8889 5.90176L15.4444 6.73323L14.8889 5.90176ZM14.3371 11.6758L15.1685 11.1203L14.3371 11.6758ZM14.8889 12.2276L15.4444 11.3962L14.8889 12.2276ZM9 9.5647V13.0389H11V9.5647H9ZM5.37361 17.8465L2.72528 18.6032L3.27472 20.5262L5.92305 19.7696L5.37361 17.8465ZM9 13.0389C9 15.2713 7.52011 17.2332 5.37361 17.8465L5.92305 19.7696C8.92816 18.911 11 16.1643 11 13.0389H9ZM5.5 6.5647H6.5V4.5647H5.5V6.5647ZM6.5 11.5647H5.5V13.5647H6.5V11.5647ZM9 9.0647C9 9.78774 8.99879 10.2548 8.963 10.6066C8.92891 10.9417 8.87191 11.0597 8.83147 11.1203L10.4944 12.2314C10.791 11.7875 10.9026 11.3022 10.9527 10.809C11.0012 10.3325 11 9.74612 11 9.0647H9ZM6.5 13.5647C7.18142 13.5647 7.76775 13.5659 8.24428 13.5174C8.73752 13.4673 9.22279 13.3557 9.66671 13.0591L8.55557 11.3962C8.49504 11.4366 8.37697 11.4936 8.04187 11.5277C7.69005 11.5635 7.22304 11.5647 6.5 11.5647V13.5647ZM8.83147 11.1203C8.75851 11.2295 8.66476 11.3232 8.55557 11.3962L9.66671 13.0591C9.99428 12.8402 10.2755 12.559 10.4944 12.2314L8.83147 11.1203ZM6.5 6.5647C7.22304 6.5647 7.69005 6.56591 8.04187 6.6017C8.37697 6.63578 8.49504 6.69279 8.55557 6.73323L9.66671 5.07029C9.22279 4.77367 8.73752 4.66214 8.24428 4.61196C7.76775 4.56349 7.18142 4.5647 6.5 4.5647V6.5647ZM11 9.0647C11 8.38328 11.0012 7.79694 10.9527 7.32042C10.9026 6.82718 10.791 6.34191 10.4944 5.89799L8.83147 7.00913C8.87191 7.06965 8.92891 7.18772 8.963 7.52283C8.99879 7.87464 9 8.34165 9 9.0647H11ZM8.55557 6.73323C8.66476 6.80619 8.75851 6.89994 8.83147 7.00913L10.4944 5.89799C10.2755 5.57042 9.99428 5.28916 9.66671 5.07029L8.55557 6.73323ZM3 9.0647C3 8.34165 3.00121 7.87464 3.037 7.52283C3.07109 7.18772 3.12809 7.06965 3.16853 7.00913L1.50559 5.89799C1.20897 6.34191 1.09744 6.82718 1.04727 7.32042C0.998791 7.79694 1 8.38328 1 9.0647H3ZM5.5 4.5647C4.81858 4.5647 4.23225 4.56349 3.75572 4.61196C3.26248 4.66214 2.77721 4.77367 2.33329 5.07029L3.44443 6.73323C3.50496 6.69279 3.62303 6.63578 3.95813 6.6017C4.30995 6.56591 4.77696 6.5647 5.5 6.5647V4.5647ZM3.16853 7.00913C3.24149 6.89994 3.33524 6.80619 3.44443 6.73323L2.33329 5.07029C2.00572 5.28916 1.72447 5.57042 1.50559 5.89799L3.16853 7.00913ZM1 9.0647C1 9.74612 0.998791 10.3325 1.04727 10.809C1.09744 11.3022 1.20897 11.7875 1.50559 12.2314L3.16853 11.1203C3.12809 11.0597 3.07109 10.9417 3.037 10.6066C3.00121 10.2548 3 9.78774 3 9.0647H1ZM5.5 11.5647C4.77696 11.5647 4.30995 11.5635 3.95813 11.5277C3.62303 11.4936 3.50496 11.4366 3.44443 11.3962L2.33329 13.0591C2.77721 13.3557 3.26248 13.4673 3.75572 13.5174C4.23225 13.5659 4.81858 13.5647 5.5 13.5647V11.5647ZM1.50559 12.2314C1.72447 12.559 2.00572 12.8402 2.33329 13.0591L3.44443 11.3962C3.33524 11.3232 3.24149 11.2295 3.16853 11.1203L1.50559 12.2314ZM21 9.5647V13.0389H23V9.5647H21ZM17.3736 17.8465L14.7253 18.6032L15.2747 20.5262L17.923 19.7696L17.3736 17.8465ZM21 13.0389C21 15.2713 19.5201 17.2332 17.3736 17.8465L17.923 19.7696C20.9282 18.911 23 16.1643 23 13.0389H21ZM17.5 6.5647H18.5V4.5647H17.5V6.5647ZM18.5 11.5647H17.5V13.5647H18.5V11.5647ZM21 9.0647C21 9.78774 20.9988 10.2548 20.963 10.6066C20.9289 10.9417 20.8719 11.0597 20.8315 11.1203L22.4944 12.2314C22.791 11.7875 22.9026 11.3022 22.9527 10.809C23.0012 10.3325 23 9.74612 23 9.0647H21ZM18.5 13.5647C19.1814 13.5647 19.7678 13.5659 20.2443 13.5174C20.7375 13.4673 21.2228 13.3557 21.6667 13.0591L20.5556 11.3962C20.495 11.4366 20.377 11.4936 20.0419 11.5277C19.6901 11.5635 19.223 11.5647 18.5 11.5647V13.5647ZM20.8315 11.1203C20.7585 11.2295 20.6648 11.3232 20.5556 11.3962L21.6667 13.0591C21.9943 12.8402 22.2755 12.559 22.4944 12.2314L20.8315 11.1203ZM18.5 6.5647C19.223 6.5647 19.6901 6.56591 20.0419 6.6017C20.377 6.63578 20.495 6.69279 20.5556 6.73323L21.6667 5.07029C21.2228 4.77367 20.7375 4.66214 20.2443 4.61196C19.7678 4.56349 19.1814 4.5647 18.5 4.5647V6.5647ZM23 9.0647C23 8.38328 23.0012 7.79694 22.9527 7.32042C22.9026 6.82718 22.791 6.34191 22.4944 5.89799L20.8315 7.00913C20.8719 7.06965 20.9289 7.18772 20.963 7.52283C20.9988 7.87464 21 8.34165 21 9.0647H23ZM20.5556 6.73323C20.6648 6.80619 20.7585 6.89994 20.8315 7.00913L22.4944 5.89799C22.2755 5.57042 21.9943 5.28916 21.6667 5.07029L20.5556 6.73323ZM15 9.0647C15 8.34165 15.0012 7.87464 15.037 7.52283C15.0711 7.18772 15.1281 7.06965 15.1685 7.00913L13.5056 5.89799C13.209 6.34191 13.0974 6.82718 13.0473 7.32042C12.9988 7.79694 13 8.38328 13 9.0647H15ZM17.5 4.5647C16.8186 4.5647 16.2322 4.56349 15.7557 4.61196C15.2625 4.66214 14.7772 4.77367 14.3333 5.07029L15.4444 6.73323C15.505 6.69279 15.623 6.63578 15.9581 6.6017C16.3099 6.56591 16.777 6.5647 17.5 6.5647V4.5647ZM15.1685 7.00913C15.2415 6.89994 15.3352 6.80619 15.4444 6.73323L14.3333 5.07029C14.0057 5.28916 13.7245 5.57042 13.5056 5.89799L15.1685 7.00913ZM13 9.0647C13 9.74612 12.9988 10.3325 13.0473 10.809C13.0974 11.3022 13.209 11.7875 13.5056 12.2314L15.1685 11.1203C15.1281 11.0597 15.0711 10.9417 15.037 10.6066C15.0012 10.2548 15 9.78774 15 9.0647H13ZM17.5 11.5647C16.777 11.5647 16.3099 11.5635 15.9581 11.5277C15.623 11.4936 15.505 11.4366 15.4444 11.3962L14.3333 13.0591C14.7772 13.3557 15.2625 13.4673 15.7557 13.5174C16.2322 13.5659 16.8186 13.5647 17.5 13.5647V11.5647ZM13.5056 12.2314C13.7245 12.559 14.0057 12.8402 14.3333 13.0591L15.4444 11.3962C15.3352 11.3232 15.2415 11.2295 15.1685 11.1203L13.5056 12.2314Z" fill="black"/>\n' +
                '</svg>',
                'Blockquote',
                wrapIn(schema.nodes.blockquote)
            ),
            menuItem(
                '<svg width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">\n' +
                '<path d="M23 5.5647H10M23 12.5647H10M23 19.5647H10M7 8.0647C7 9.44541 5.88071 10.5647 4.5 10.5647C3.11929 10.5647 2 9.44541 2 8.0647C2 6.68399 3.11929 5.5647 4.5 5.5647C5.88071 5.5647 7 6.68399 7 8.0647ZM7 17.0647C7 18.4454 5.88071 19.5647 4.5 19.5647C3.11929 19.5647 2 18.4454 2 17.0647C2 15.684 3.11929 14.5647 4.5 14.5647C5.88071 14.5647 7 15.684 7 17.0647Z" stroke="black" stroke-width="2" stroke-linejoin="round"/>\n' +
                '</svg>',
                'Bullet list',
                wrapInList(schema.nodes.bullet_list)
            ),
            menuItem(
                '<svg width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">\n' +
                '<path d="M23 5.5647H9M23 12.5647H9M23 19.5647H9M1.5 6.5647L3.5 5.5647V10.5647M3.5 10.5647H1.5M3.5 10.5647H5.5M1 14.5647H3.69722C4.41673 14.5647 5 15.148 5 15.8675C5 16.3031 4.7823 16.7098 4.41987 16.9514L2 18.5647V19.5647H6" stroke="black" stroke-width="2" stroke-linejoin="round"/>\n' +
                '</svg>',
                'Ordered list',
                wrapInList(schema.nodes.ordered_list)
            )
        ],
        
        // Actions group
        [
            menuItem(
                '<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 7L7 3L7 6L17 6L17 8L7 8L7 11L3 7Z"/></svg>',
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
                '<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M17 7L13 3L13 6L3 6L3 8L13 8L13 11L17 7Z"/></svg>',
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
                '<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="4" y1="10" x2="16" y2="10"/></svg>',
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
                '<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="4" width="14" height="10" rx="1"/><circle cx="7" cy="8" r="1.2"/><path d="M12 12L15 9"/></svg>',
                'Insert image',
                insertImageCommand(schema)
            ),
            menuItem(
                '<svg viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M10 8L13 11M10 8L7 11M10 8V4"/></svg>',
                'Hard break',
                insertHardBreakCommand(schema),
                null,
                'Shift-Enter'
            ),
            menuItem(
                '<svg width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">\n' +
                '<path d="M19 15.5647L10 6.5647M18.2382 4.85504L20.7461 7.43574C22.418 9.1562 22.418 11.9456 20.7461 13.6661L13.854 20.7582C13.3522 21.2746 12.6716 21.5647 11.962 21.5647H5.61621C4.90656 21.5647 4.22597 21.2746 3.72417 20.7582L3.25394 20.2744C1.58202 18.5539 1.58202 15.7645 3.25394 14.044L12.1836 4.85504C13.8556 3.13458 16.5663 3.13458 18.2382 4.85504Z" stroke="black" stroke-width="2" stroke-linejoin="round"/>\n' +
                '</svg>',
                'Clear formatting',
                clearFormattingCommand(schema),
                null,
                'Mod-\\'
            ),
            menuItem(
                '<svg width="24" height="25" viewBox="0 0 24 25" fill="none" xmlns="http://www.w3.org/2000/svg">\n' +
                '<path d="M8 2.5647V22.5647M2 15.5647H22M2 9.5647H22M10 22.5647H14C17.7712 22.5647 19.6569 22.5647 20.8284 21.3931C22 20.2216 22 18.3359 22 14.5647V10.5647C22 6.79346 22 4.90784 20.8284 3.73627C19.6569 2.5647 17.7712 2.5647 14 2.5647H10C6.22876 2.5647 4.34315 2.5647 3.17157 3.73627C2 4.90784 2 6.79346 2 10.5647V14.5647C2 18.3359 2 20.2216 3.17157 21.3931C4.34315 22.5647 6.22876 22.5647 10 22.5647Z" stroke="black" stroke-width="2"/>\n' +
                '</svg>',
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