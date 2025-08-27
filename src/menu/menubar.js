import { Plugin, PluginKey } from 'prosemirror-state';
import { MenuView } from './menu.js';

/**
 * MenuBar plugin for ProseMirror
 * Creates a toolbar menu that updates with editor state changes
 */

/**
 * Create the menu bar plugin
 * @param {Array<Array<import('./menu.js').MenuItem>>} menuItems - Grouped menu items
 * @returns {import('prosemirror-state').Plugin} Menu bar plugin
 */
export function menuBar(menuItems) {
    return new Plugin({
        key: new PluginKey('menubar'),
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
