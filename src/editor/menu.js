import { Plugin, PluginKey } from 'prosemirror-state';
import { toggleMark, setBlockType, wrapIn, lift, joinUp, selectParentNode } from 'prosemirror-commands';
import { undo, redo } from 'prosemirror-history';
import { wrapInList, splitListItem, liftListItem, sinkListItem } from 'prosemirror-schema-list';
import { keymap } from 'prosemirror-keymap';

/**
 * Custom menu plugin for ProseMirror markdown editing
 * Provides a toolbar with essential markdown formatting options
 */

class MenuView {
    constructor(items, editorView) {
        this.items = items;
        this.editorView = editorView;
        
        // Create menu DOM element
        this.dom = document.createElement('div');
        this.dom.className = 'prosemirror-menu';
        
        // Create menu groups
        this.createMenuGroups(items);
        
        // Handle menu item clicks
        this.dom.addEventListener('mousedown', this.handleClick.bind(this));
        
        this.update();
    }
    
    createMenuGroups(items) {
        items.forEach((group, groupIndex) => {
            if (groupIndex > 0) {
                // Add separator between groups
                const separator = document.createElement('div');
                separator.className = 'menu-separator';
                this.dom.appendChild(separator);
            }
            
            const groupEl = document.createElement('div');
            groupEl.className = 'menu-group';
            
            group.forEach(item => {
                groupEl.appendChild(item.dom);
            });
            
            this.dom.appendChild(groupEl);
        });
    }
    
    handleClick(e) {
        e.preventDefault();
        this.editorView.focus();
        
        // Find which item was clicked
        for (const group of this.items) {
            for (const item of group) {
                if (item.dom.contains(e.target)) {
                    if (item.command) {
                        item.command(this.editorView.state, this.editorView.dispatch, this.editorView);
                    }
                    return;
                }
            }
        }
    }
    
    update() {
        const state = this.editorView.state;
        
        for (const group of this.items) {
            for (const item of group) {
                if (item.command) {
                    // Check if command is applicable (without dispatching)
                    const enabled = item.command(state, null, this.editorView);
                    item.dom.classList.toggle('disabled', !enabled);
                    
                    // Check if mark/block is currently active
                    if (item.isActive) {
                        item.dom.classList.toggle('active', item.isActive(state));
                    }
                }
            }
        }
    }
    
    destroy() {
        this.dom.remove();
    }
}

// Helper function to create menu items with keyboard shortcuts
function menuItem(icon, title, command, isActive = null, shortcut = null) {
    const dom = document.createElement('button');
    dom.className = 'menu-item';
    dom.innerHTML = icon;
    dom.type = 'button';
    
    // Add title with optional keyboard shortcut
    let fullTitle = title;
    if (shortcut) {
        // Format shortcut for display (Mod = Cmd/Ctrl)
        const displayShortcut = shortcut.replace('Mod', navigator.platform.includes('Mac') ? '⌘' : 'Ctrl');
        fullTitle = `${title} (${displayShortcut})`;
    }
    dom.title = fullTitle;
    
    return { dom, command, isActive, shortcut };
}

// Helper function to check if a mark is active
function markActive(markType) {
    return (state) => {
        const { from, $from, to, empty } = state.selection;
        if (empty) return markType.isInSet(state.storedMarks || $from.marks());
        return state.doc.rangeHasMark(from, to, markType);
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
                toggleMark(schema.marks.strong),
                markActive(schema.marks.strong),
                'Mod-b'
            ),
            menuItem(
                '<em>I</em>',
                'Italic',
                toggleMark(schema.marks.em),
                markActive(schema.marks.em),
                'Mod-i'
            ),
            menuItem(
                '<code>`</code>',
                'Code',
                toggleMark(schema.marks.code),
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
                'Mod-z'
            ),
            menuItem(
                'redo',
                'Redo',
                redo,
                null,
                'Mod-Shift-z'
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
    keys['Mod-b'] = toggleMark(schema.marks.strong);
    keys['Mod-i'] = toggleMark(schema.marks.em);
    keys['Mod-`'] = toggleMark(schema.marks.code);
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