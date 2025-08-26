import { joinBackward, lift, selectNodeBackward } from 'prosemirror-commands';
import { liftListItem, sinkListItem } from 'prosemirror-schema-list';
import { atBlockStart, deleteBarrier, findCutBefore } from './transforms.js';

/**
 * Debug flag for command logging
 */
const DEBUG = false;

/**
 * Exact copy of joinBackward from prosemirror-commands
 * If the selection is empty and at the start of a textblock, try to
 * reduce the distance between that block and the one before it—if
 * there's a block directly before it that can be joined, join them.
 * If not, try to move the selected block closer to the next one in
 * the document structure by lifting it out of its parent or moving it
 * into a parent of the previous block.
 */
export function customJoinBackward(schema) {
    return (state, dispatch, view) => {
        let $cursor = atBlockStart(state, view);
        if (!$cursor) return false;

        let $cut = findCutBefore($cursor);
        if (!$cut) {
            return false; // fallback to default impl
        }

        // Apply the joining algorithm
        return deleteBarrier(state, $cut, dispatch, -1);
    };
}

/**
 * Custom backspace command that resets block to paragraph first
 * @param {import('prosemirror-model').Schema} schema - ProseMirror schema
 * @returns {import('../menu/menu.d.ts').CommandFn} Custom backspace command
 */
export function customBackspace(schema) {
    return (state, dispatch, view) => {
        if (!state.selection.empty) {
            return false;
        }

        const atStart = atBlockStart(state, view);

        // Only handle if at block start
        if (!atStart) {
            // if (DEBUG) console.log('skip not atStart');
            return false;
        }

        const { $from } = state.selection;
        const parent = $from.parent;

        // If already a paragraph, try various backspace behaviors
        if (parent.type === schema.nodes.paragraph) {
            // if (DEBUG) console.log('already paragraph');

            // Check if we're in a list item and handle different scenarios
            const grandparent = $from.node($from.depth - 1);
            if (grandparent && grandparent.type === schema.nodes.list_item) {
                // Check if this is a second (or later) paragraph in a list item
                // Pattern: <li><p>first</p><p>|second</p></li> where | is cursor
                const listItemNode = grandparent;
                const paragraphIndex = $from.index($from.depth - 1);

                if (paragraphIndex > 0) {
                    // This is not the first paragraph in the list item
                    // Try joinBackward to merge with the previous paragraph
                    if (DEBUG) console.log('second+ paragraph in list item, trying joinBackward');
                    if (joinBackward(state, dispatch)) {
                        return true;
                    }
                }

                // Handle nested list items
                const ancestor = $from.node($from.depth - 3);
                if (ancestor && ancestor.type === schema.nodes.list_item) {
                    if (joinBackward(state, dispatch)) {
                        return true;
                    }
                } else {
                    // if (DEBUG) console.log('in list item, trying liftListItem');
                    if (liftListItem(schema.nodes.list_item)(state, dispatch)) {
                        return true;
                    }
                }
            }

            // if (DEBUG) console.log('lift');
            if (lift(state, dispatch)) {
                return true;
            }

            // if (DEBUG) console.log('customJoinBackward');
            if (customJoinBackward(schema)(state, dispatch)) {
                return true;
            }

            if (DEBUG) console.log('joinBackward fallback');
            if (joinBackward(state, dispatch)) {
                return true;
            }

            if (DEBUG) console.log('selectNodeBackward');
            if (selectNodeBackward(state, dispatch)) {
                return true;
            }

            return true;
        }

        // Reset block to paragraph
        if (dispatch) {
            const tr = state.tr;
            tr.setBlockType($from.before(), $from.after(), schema.nodes.paragraph);
            dispatch(tr);
        }
        return true;
    };
}

/**
 * Custom sink list item command that skips sinking for multi-paragraph list items
 * @param {import('prosemirror-model').Schema} schema - ProseMirror schema
 * @returns {import('../menu/menu.d.ts').CommandFn} Custom sink list item command
 */
export function customSinkListItem(schema) {
    let sinkListCommand = sinkListItem(schema.nodes.list_item);

    return (state, dispatch, view) => {
        const { $from } = state.selection;

        // Check if we're in a paragraph within a list item
        if ($from.parent.type === schema.nodes.paragraph) {
            const grandparent = $from.node($from.depth - 1);
            if (grandparent && grandparent.type === schema.nodes.list_item) {
                // Check if this list item contains multiple paragraphs
                const listItemNode = grandparent;
                if (listItemNode.childCount > 1) {
                    // Check if cursor is at the first paragraph
                    const paragraphIndex = $from.index($from.depth - 1);
                    if (paragraphIndex > 0) {
                        // We're in a second+ paragraph of multi-paragraph list item
                        // Skip sinking to avoid breaking structure
                        if (DEBUG) console.log('multi-paragraph list item (not first paragraph), skipping sink');
                        return false;
                    }
                    // If we're in the first paragraph, continue with normal sinking behavior
                }
            }
        }

        // Use standard sinkListItem behavior for single-paragraph list items
        // or first paragraph of multi-paragraph list items
        return sinkListCommand(state, dispatch, view);
    };
}

/**
 * Custom lift list item command that skips lifting for multi-paragraph list items
 * @param {import('prosemirror-model').Schema} schema - ProseMirror schema
 * @returns {import('../menu/menu.d.ts').CommandFn} Custom lift list item command
 */
export function customLiftListItem(schema) {
    let liftListCommand = liftListItem(schema.nodes.list_item);

    return (state, dispatch, view) => {
        const { $from } = state.selection;

        // Check if we're in a paragraph within a list item
        if ($from.parent.type === schema.nodes.paragraph) {
            const grandparent = $from.node($from.depth - 1);
            if (grandparent && grandparent.type === schema.nodes.list_item) {
                // Check if this list item contains multiple paragraphs
                const listItemNode = grandparent;
                if (listItemNode.childCount > 1) {
                    // Check if cursor is at the first paragraph
                    const paragraphIndex = $from.index($from.depth - 1);
                    if (paragraphIndex > 0) {
                        // We're in a second+ paragraph of multi-paragraph list item
                        // Skip lifting to avoid breaking structure
                        if (DEBUG) console.log('multi-paragraph list item (not first paragraph), skipping lift');
                        return false;
                    }
                    // If we're in the first paragraph, continue with normal lifting behavior
                }
            }
        }

        // Use standard liftListItem behavior for single-paragraph list items
        // or first paragraph of multi-paragraph list items
        return liftListCommand(state, dispatch, view);
    };
}
