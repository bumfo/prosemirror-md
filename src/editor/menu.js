import { Plugin, PluginKey } from 'prosemirror-state';
import { toggleMark, setBlockType, wrapIn, lift } from 'prosemirror-commands';
import { undo, redo } from 'prosemirror-history';
import { wrapInList, splitListItem, liftListItem, sinkListItem } from 'prosemirror-schema-list';

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
                    // Check if command is applicable
                    const active = item.command(state, null, this.editorView);
                    item.dom.classList.toggle('disabled', !active);
                    
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

// Helper function to create menu items
function menuItem(icon, title, command, isActive = null) {
    const dom = document.createElement('button');
    dom.className = 'menu-item';
    dom.innerHTML = icon;
    dom.title = title;
    dom.type = 'button';
    
    return { dom, command, isActive };
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
            if (dispatch) {
                dispatch(state.tr.removeMark(from, to, markType));
            }
        } else {
            // Add/update link
            if (dispatch) {
                dispatch(state.tr.addMark(from, to, markType.create({ href: url })));
            }
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
                'Bold (Ctrl+B)',
                toggleMark(schema.marks.strong),
                markActive(schema.marks.strong)
            ),
            menuItem(
                '<em>I</em>',
                'Italic (Ctrl+I)',
                toggleMark(schema.marks.em),
                markActive(schema.marks.em)
            ),
            menuItem(
                '<code>`</code>',
                'Code (Ctrl+`)',
                toggleMark(schema.marks.code),
                markActive(schema.marks.code)
            ),
            menuItem(
                '🔗',
                'Link (Ctrl+K)',
                linkCommand(schema.marks.link),
                markActive(schema.marks.link)
            )
        ],
        
        // Block types group
        [
            menuItem(
                '¶',
                'Paragraph',
                setBlockType(schema.nodes.paragraph),
                blockActive(schema.nodes.paragraph)
            ),
            menuItem(
                '<strong>H1</strong>',
                'Heading 1',
                setBlockType(schema.nodes.heading, { level: 1 }),
                blockActive(schema.nodes.heading, { level: 1 })
            ),
            menuItem(
                '<strong>H2</strong>',
                'Heading 2',
                setBlockType(schema.nodes.heading, { level: 2 }),
                blockActive(schema.nodes.heading, { level: 2 })
            ),
            menuItem(
                '<strong>H3</strong>',
                'Heading 3',
                setBlockType(schema.nodes.heading, { level: 3 }),
                blockActive(schema.nodes.heading, { level: 3 })
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
                '↶',
                'Undo (Ctrl+Z)',
                undo
            ),
            menuItem(
                '↷',
                'Redo (Ctrl+Shift+Z)',
                redo
            ),
            menuItem(
                '―',
                'Horizontal rule',
                (state, dispatch) => {
                    if (dispatch) {
                        const { tr } = state;
                        const node = schema.nodes.horizontal_rule.create();
                        dispatch(tr.replaceSelectionWith(node));
                    }
                    return true;
                }
            )
        ]
    ];
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