import { joinBackward, lift, selectNodeBackward } from 'prosemirror-commands';
import { liftListItem, sinkListItem } from 'prosemirror-schema-list';
import { atBlockStart, deleteBarrier, findCutBefore } from './transforms.js';
import { findWrapping, ReplaceAroundStep, canSplit, liftTarget, canJoin } from 'prosemirror-transform';
import { NodeRange, Fragment, Slice } from 'prosemirror-model';

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
    let liftListCommand = backspaceListItem(schema.nodes.list_item);

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
                if (DEBUG) console.log('in list item, trying liftListItem');
                if (liftListCommand(state, dispatch)) {
                    return true;
                }

                // Check if this is a second (or later) paragraph in a list item
                // Pattern: <li><p>first</p><p>|second</p></li> where | is cursor
                const listItemNode = grandparent;
                const paragraphIndex = $from.index($from.depth - 1);

                if (paragraphIndex > 0) {
                    if (DEBUG) console.log('lift');
                    if (lift(state, dispatch)) {
                        return true;
                    }

                    // if (DEBUG) console.log('second+ paragraph in list item, trying joinBackward');
                    // if (joinBackward(state, dispatch)) {
                    //     return true;
                    // }
                }

                // Handle nested list items
                const ancestor = $from.node($from.depth - 3);
                if (ancestor && ancestor.type === schema.nodes.list_item) {
                    // Check if current list item is the first child of its parent list
                    const parentList = $from.node($from.depth - 2);
                    const listItemIndex = $from.index($from.depth - 2);

                    if (listItemIndex === 0) {
                        // First item in nested list - try joinBackward to merge with ancestor
                        if (DEBUG) console.log('first item in nested list, joinBackward');
                        if (joinBackward(state, dispatch)) {
                            return true;
                        }
                    } else {
                        // Not first item - try liftListItem instead
                        if (DEBUG) console.log('not first item in nested list, lift');
                        if (lift(state, dispatch)) {
                            return true;
                        }
                    }
                } else {
                    if (DEBUG) console.log('in list item, trying liftListItem');
                    if (liftListCommand(state, dispatch)) {
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


/**
 Create a command to lift the list item around the selection up into
 a wrapping list.
 */
function backspaceListItem(itemType) {
    return function (state, dispatch) {
        let { $from, $to } = state.selection;
        let range = $from.blockRange($to, node => node.childCount > 0 && node.firstChild.type === itemType);
        if (!range)
            return false;
        if (!dispatch)
            return true;
        if ($from.node(range.depth - 1).type === itemType) // Inside a parent list
            return liftToOuterList(state, dispatch, itemType, range);
        else // Outer list node
            return liftOutOfList(state, dispatch, range);
    };
}

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
    dispatch(tr.scrollIntoView());
    return true;
}

function liftOutOfList(state, dispatch, range) {
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
    dispatch(tr.scrollIntoView());
    return true;
}
