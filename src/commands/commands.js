import { joinBackward, lift, selectNodeBackward } from 'prosemirror-commands';
import { liftListItem, sinkListItem } from 'prosemirror-schema-list';
import { atBlockStart, customDeleteBarrier, findCutBefore } from './transforms.js';
import { findWrapping, ReplaceAroundStep, canSplit, liftTarget, canJoin } from 'prosemirror-transform';
import { NodeRange, Fragment, Slice } from 'prosemirror-model';
import { Transform } from 'prosemirror-transform';

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
 * @returns {Command}
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
        return customDeleteBarrier(state, $cut, dispatch, -1);
    };
}

/**
 * Custom backspace command that resets block to paragraph first
 * @param {Schema} schema - ProseMirror schema
 * @returns {Command} Custom backspace command
 */
export function customBackspace(schema) {
    const itemType = schema.nodes.list_item;

    /**
     * @param {EditorState} state
     * @param {(tr: any) => void} dispatch
     * @returns {boolean}
     */
    function backspaceList(state, dispatch) {
        let { $from, $to, from } = state.selection;

        let listPredicate = node => node.childCount > 0 && node.firstChild.type === itemType;
        let listRange = $from.blockRange($to, listPredicate);
        if (listRange) {
            if (DEBUG) console.log('backspaceList');

            // Check if this is a second (or later) paragraph in a list item
            const paragraphIndex = $from.index($from.depth - 1);
            if (paragraphIndex > 0) {
                if (DEBUG) console.log('second+ paragraph in list item');

                let pos = $from.before($from.depth);
                let $pos = state.doc.resolve(pos);

                let tr = state.tr;

                let nextType = pos === $pos.end() ? $pos.parent.contentMatchAt(0).defaultType : null;
                let types = nextType ? [null, { type: nextType }] : undefined;

                if (canSplit(tr.doc, pos, 1, types)) {
                    tr.split(pos, 1, types);

                    $pos = tr.doc.resolve(tr.mapping.map(pos));
                    if (liftOutOfListTransform(tr, $pos.blockRange($pos, listPredicate))) {
                        dispatch(tr);
                        return true;
                    }
                }

                return true;
            }

            if (liftOutOfList(state, dispatch, listRange)) {
                return true;
            }
        }

        return false;
    }

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

        if (parent.type !== schema.nodes.paragraph) {
            // Reset block to paragraph
            if (dispatch) {
                const tr = state.tr;
                tr.setBlockType($from.before(), $from.after(), schema.nodes.paragraph);
                dispatch(tr);
            }

            return true;
        }
        // Else, already a paragraph, try various backspace behaviors            

        if (backspaceList(state, dispatch)) {
            return true;
        }

        if (DEBUG) console.log('lift');
        if (lift(state, dispatch)) {
            return true;
        }

        if (DEBUG) console.log('customJoinBackward');
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

    return command;
}

/**
 * Custom sink list item command that skips sinking for multi-paragraph list items
 * @param {Schema} schema - ProseMirror schema
 * @returns {Command} Custom sink list item command
 */
export function customSinkListItem(schema) {
    const itemType = schema.nodes.list_item;
    let sinkListCommand = sinkListItem(itemType);

    return (state, dispatch, view) => {
        const { $from } = state.selection;

        // Check if we're in a paragraph within a list item
        if ($from.parent.type === schema.nodes.paragraph) {
            const grandparent = $from.node($from.depth - 1);
            if (grandparent && grandparent.type === itemType) {
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
 * @param {Schema} schema - ProseMirror schema
 * @returns {Command} Custom lift list item command
 */
export function customLiftListItem(schema) {
    const itemType = schema.nodes.list_item;
    let liftListCommand = liftListItem(itemType);

    return (state, dispatch, view) => {
        const { $from } = state.selection;

        // Check if we're in a paragraph within a list item
        if ($from.parent.type === schema.nodes.paragraph) {
            const grandparent = $from.node($from.depth - 1);
            if (grandparent && grandparent.type === itemType) {
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

/**
 * @param {EditorState} state
 * @param {(tr: any) => void} dispatch
 * @param {any} itemType
 * @param {NodeRange} range
 * @returns {boolean}
 */
function liftToOuterList(state, dispatch, itemType, range) {
    let tr = state.tr, end = range.end, endOfList = range.$to.end(range.depth);
    if (end < endOfList) {
        // There are siblings after the lifted items, which must become
        // children of the last item
        tr.step(new ReplaceAroundStep(end - 1, endOfList, end, endOfList, new Slice(Fragment.from(itemType.create(null, range.parent.copy())), 1, 0), 1, true));
        range = new NodeRange(tr.doc.resolve(range.$from.pos), tr.doc.resolve(endOfList), range.depth);
    }
    const target = liftTarget(range);
    if (target == null)
        return false;
    tr.lift(range, target);
    let $after = tr.doc.resolve(tr.mapping.map(end, -1) - 1);
    if (canJoin(tr.doc, $after.pos) && $after.nodeBefore.type === $after.nodeAfter.type)
        tr.join($after.pos);
    if (dispatch) dispatch(tr.scrollIntoView());
    return true;
}

/**
 * @param {EditorState} state
 * @param {(tr: any) => void} dispatch
 * @param {NodeRange} range
 * @returns {boolean}
 */
function liftOutOfList(state, dispatch, range) {
    let tr = state.tr;
    if (liftOutOfListTransform(tr, range)) {
        if (dispatch) dispatch(tr.scrollIntoView());
        return true;
    }
    return false;
}

/**
 * @param {Transform} tr
 * @param {NodeRange} range
 * @returns {boolean}
 */
function liftOutOfListTransform(tr, range) {
    let steps = tr.steps.length;
    let list = range.parent;
    // Merge the list items into a single big item
    for (let pos = range.end, i = range.endIndex - 1, e = range.startIndex; i > e; i--) {
        pos -= list.child(i).nodeSize;
        tr.delete(pos - 1, pos + 1);
    }
    let $start = tr.doc.resolve(range.start), item = $start.nodeAfter;
    if (tr.mapping.slice(steps).map(range.end) !== range.start + $start.nodeAfter.nodeSize)
        return false;
    let atStart = range.startIndex === 0, atEnd = range.endIndex === list.childCount;
    let parent = $start.node(-1), indexBefore = $start.index(-1);
    if (!parent.canReplace(indexBefore + (atStart ? 0 : 1), indexBefore + 1, item.content.append(atEnd ? Fragment.empty : Fragment.from(list))))
        return false;
    let start = $start.pos, end = start + item.nodeSize;
    // Strip off the surrounding list. At the sides where we're not at
    // the end of the list, the existing list is closed. At sides where
    // this is the end, it is overwritten to its end.
    tr.step(new ReplaceAroundStep(start - (atStart ? 1 : 0), end + (atEnd ? 1 : 0), start + 1, end - 1, new Slice((atStart ? Fragment.empty : Fragment.from(list.copy(Fragment.empty)))
        .append(atEnd ? Fragment.empty : Fragment.from(list.copy(Fragment.empty))), atStart ? 0 : 1, atEnd ? 0 : 1), atStart ? 0 : 1));
    return true;
}
