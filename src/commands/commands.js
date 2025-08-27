import { joinBackward, lift, selectNodeBackward } from 'prosemirror-commands';
import { atBlockStart, customDeleteBarrier, findCutBefore } from './transforms.js';
import { backspaceList } from './list_commands.js';

/**
 * @typedef {import('prosemirror-state').EditorState} EditorState
 * @typedef {import('prosemirror-model').Schema} Schema
 * @typedef {import('prosemirror-model').NodeType} NodeType
 * @typedef {import('prosemirror-model').ResolvedPos} ResolvedPos
 * @typedef {(state: EditorState, dispatch?: (tr: any) => void, view?: EditorView) => boolean} Command
 */

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
 *
 * @param {EditorState} state
 * @param {(tr: any) => void} dispatch
 * @param {any} view
 * @returns {boolean}
 */
export function customJoinBackward(state, dispatch, view) {
    let $cursor = atBlockStart(state, view);
    if (!$cursor) return false;

    let $cut = findCutBefore($cursor);
    if (!$cut) {
        return false; // fallback to default impl
    }

    // Apply the joining algorithm
    return customDeleteBarrier(state, $cut, dispatch);
}

/**
 * Custom backspace command that resets block to paragraph first
 * @param {Schema} schema - ProseMirror schema
 * @returns {Command} Custom backspace command
 */
export function customBackspace(schema) {
    const paragraphType = schema.nodes.paragraph
    const itemType = schema.nodes.list_item

    /**
     * @param {EditorState} state
     * @param {(tr: any) => void} dispatch
     * @param {any} view
     * @returns {boolean}
     */
    function command(state, dispatch, view) {
        if (!state.selection.empty) {
            return false;
        }

        const atStart = atBlockStart(state, view);

        // Only handle if at block start
        if (!atStart) {
            // if (DEBUG) console.log('skip not atStart');
            return false;
        }

        let { $from } = state.selection;
        const parent = $from.parent;

        if (parent.type !== paragraphType) {
            // Reset block to paragraph
            if (dispatch) {
                const tr = state.tr;
                tr.setBlockType($from.before(), $from.after(), paragraphType);
                dispatch(tr);
            }

            return true;
        }
        // Else, already a paragraph, try various backspace behaviors            

        if (backspaceList(state, dispatch, itemType)) {
            return true;
        }

        if (DEBUG) console.log('lift');
        if (lift(state, dispatch)) {
            return true;
        }

        if (DEBUG) console.log('customJoinBackward');
        if (customJoinBackward(state, dispatch, view)) {
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

    return command;
}
