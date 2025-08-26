import { joinBackward, lift, selectNodeBackward } from 'prosemirror-commands';
import { liftListItem, sinkListItem } from 'prosemirror-schema-list';
import { atBlockStart, deleteBarrier, findCutBefore } from './transforms.js';
import { findWrapping, ReplaceAroundStep, canSplit, liftTarget, canJoin } from 'prosemirror-transform';
import { NodeRange, Fragment, Slice } from 'prosemirror-model';

/**
 * @typedef {import('prosemirror-state').EditorState} EditorState
 * @typedef {import('prosemirror-model').Schema} Schema
 * @typedef {import('prosemirror-model').NodeType} NodeType
 * @typedef {(state: EditorState, dispatch?: (tr: any) => void, view?: EditorView) => boolean} Command
 */

/**
 * Debug flag for command logging
 */
const DEBUG = true;


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
        return deleteBarrier(state, $cut, dispatch, -1);
    };
}

/**
 * Custom backspace command that resets block to paragraph first
 * @param {Schema} schema - ProseMirror schema
 * @returns {Command} Custom backspace command
 */
export function customBackspace(schema) {
    const itemType = schema.nodes.list_item;
    const wrapInList = wrapIn(itemType);

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

        let { $from, $to, from } = state.selection;
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

        let listPredicate = node => node.childCount > 0 && node.firstChild.type === itemType;
        let listRange = $from.blockRange($to, listPredicate);
        if (listRange) {
            console.log('listRange', listRange.$from.toString(), listRange.$to.toString());
            // Check if this is a second (or later) paragraph in a list item
            const paragraphIndex = $from.index($from.depth - 1);
            if (paragraphIndex > 0) {
                if (DEBUG) console.log('second+ paragraph in list item, skip');

                let steps = state.tr.steps.length;
                const tr = wrapInList(state);
                if (tr) {
                    console.log('wrapInList', steps, tr.steps.length);

                    let mapping = tr.mapping.slice(steps);
                    let $pos = tr.doc.resolve(mapping.map(from - 1));
                    let range = $pos.blockRange($pos, listPredicate);
                    console.log(range.$from.toString(), range.$from.parent.toString());
                    // dispatch(tr);
                    
                    if (liftToOuterList(state, dispatch, itemType, listRange)) {
                        return true;
                    }

                    if (liftOutOfList(state, dispatch, range)) {
                        return true;
                    } else {
                        console.log('liftOutOfList fails');

                        dispatch(tr);
                        return true;
                    }
                }

                // if (lift(state, dispatch)) {
                // }
                // if (customJoinBackward(schema)(state, dispatch)) {
                //     return true;
                // }
                // if (joinBackward(state, dispatch)) {
                //     return true;
                // }

                return true;
            }

            if ($from.node(listRange.depth - 1).type === itemType) { // Inside a parent list
                if (liftOutOfList(state, dispatch, listRange)) {
                    return true;
                }

                // if (liftToOuterList(state, dispatch, itemType, listRange)) {
                //     return true;
                // }

            } else { // Outer list node
                if (liftOutOfList(state, dispatch, listRange)) {
                    return true;
                }
            }
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
 * @param {NodeType} nodeType
 */
function wrapIn(nodeType) {
    /**
     * @param {EditorState} state
     */
    function func(state) {
        let { $from: $start, from: start } = state.selection;

        let tr = state.tr;
        let range = $start.blockRange(),
            wrapping = range && findWrapping(range, nodeType);

        if (!wrapping) {
            console.log('no wrapping');
            return null;
        }
        tr.wrap(range, wrapping);
        console.log('wrap', wrapping);

        // APPROACH 2: Simplified Operation Reordering
        // Calculate all positions before any joins (prevents invalidation)
        let before = tr.doc.resolve(start - 1).nodeBefore;
        let afterPos = tr.doc.resolve(start).end() + 1;
        let after = tr.doc.resolve(afterPos).nodeAfter;

        // Join AFTER first: This operation doesn't affect the 'start - 1' position
        // needed for the subsequent 'join before' operation
        if (after && after.type === nodeType && canJoin(tr.doc, afterPos))
            tr.join(afterPos);

        // Join BEFORE second: The 'start - 1' position is still valid after joining after
        if (before && before.type === nodeType && canJoin(tr.doc, start - 1))
            tr.join(start - 1);

        return tr;
    }

    return func;
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
    console.log('liftToOuterList');
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
    console.log('liftOutOfList');
    let tr = state.tr, list = range.parent;
    // Merge the list items into a single big item
    for (let pos = range.end, i = range.endIndex - 1, e = range.startIndex; i > e; i--) {
        pos -= list.child(i).nodeSize;
        tr.delete(pos - 1, pos + 1);
    }
    let $start = tr.doc.resolve(range.start), item = $start.nodeAfter;
    if (tr.mapping.map(range.end) !== range.start + $start.nodeAfter.nodeSize)
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
    if (dispatch) dispatch(tr.scrollIntoView());
    return true;
}
