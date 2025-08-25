import { toggleMark, setBlockType, wrapIn } from 'prosemirror-commands';
import { undo, redo } from 'prosemirror-history';
import { wrapInList, splitListItem, liftListItem, sinkListItem } from 'prosemirror-schema-list';
import { keymap } from 'prosemirror-keymap';
import { 
    MenuItem, 
    markItem, 
    blockTypeItem, 
    wrapItem, 
    customToggleMark, 
    markActive, 
    blockActive,
    menuBar,
    icons 
} from '../menu/index.js';

/**
 * Editor-specific menu configuration and commands
 * Provides markdown editor specific menu items and keybindings
 *
 * @fileoverview Editor-specific menu configuration
 */

// Debug mode configuration
const DEBUG_MENU = false;

/**
 * @typedef {import('prosemirror-view').EditorView} EditorView
 * @typedef {import('prosemirror-state').EditorState} EditorState
 * @typedef {import('../menu/menu.d.ts').MenuItem} MenuItem
 * @typedef {import('../menu/menu.d.ts').IconSpec} IconSpec
 * @typedef {import('../menu/menu.d.ts').MenuItemSpec} MenuItemSpec
 * @typedef {import('../menu/menu.d.ts').CommandFn} CommandFn
 * @typedef {import('../menu/menu.d.ts').ActiveFn} ActiveFn
 * @typedef {import('../menu/menu.d.ts').EnableFn} EnableFn
 * @typedef {import('../menu/menu.d.ts').StateContext} StateContext
 */

/**
 * Create menu item with keyboard shortcut (legacy helper for backward compatibility)
 * @param {IconSpec|string} icon - Icon specification or HTML string
 * @param {string} title - Item title
 * @param {CommandFn} command - Command function
 * @param {ActiveFn|null} [isActive] - Active state function
 * @param {string|null} [shortcut] - Keyboard shortcut
 * @param {EnableFn|null} [isEnabled] - Enable state function
 * @returns {MenuItem} Menu item instance
 */
export function menuItem(icon, title, command, isActive = null, shortcut = null, isEnabled = null) {
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
 * Helper function to prompt for link URL
 * @param {import('prosemirror-model').MarkType} markType - Link mark type
 * @returns {import('../menu/menu.d.ts').CommandFn} Link command function
 */
function linkCommand(markType) {
    return (state, dispatch, view) => {
        if (state.selection.empty) return false;

        // If dispatch is null, we're just checking if command is available
        if (!dispatch) return true;

        const { from, to } = state.selection;
        const start = state.doc.resolve(from);
        // const end = state.doc.resolve(to);

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
                        const { tr } = state;
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
                title: 'Clear formatting (Mod-\\\\)',
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
 * @returns {import('../menu/menu.d.ts').CommandFn} Image insertion command
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
 * @returns {import('../menu/menu.d.ts').CommandFn} Hard break command
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
 * @returns {import('../menu/menu.d.ts').CommandFn} Clear formatting command
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
 * @returns {import('../menu/menu.d.ts').CommandFn} Table insertion command
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
    keys['Mod-\\\\'] = clearFormattingCommand(schema);

    return keymap(keys);
}

/**
 * Create the menu plugin
 * @param {import('prosemirror-model').Schema} schema - ProseMirror schema
 * @returns {import('prosemirror-state').Plugin} Menu plugin
 */
export function menuPlugin(schema) {
    const menuItems = createMenuItems(schema);
    return menuBar(menuItems);
}