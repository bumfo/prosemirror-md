import { canJoin, ReplaceAroundStep, ReplaceStep } from 'prosemirror-transform';
import { Fragment, Slice } from 'prosemirror-model';
import { joinBackward, lift, selectNodeBackward } from 'prosemirror-commands';
import { liftListItem } from 'prosemirror-schema-list';

/**
 * Debug flag for command logging
 */
const DEBUG = true;

// Helper functions from prosemirror-commands (exact copies)
function atBlockStart(state, view) {
    let { $cursor } = state.selection;
    if (!$cursor || (view ? !view.endOfTextblock('backward', state) : $cursor.parentOffset > 0))
        return null;
    return $cursor;
}

function findCutBefore($pos) {
    if (!$pos.parent.type.spec.isolating) for (let i = $pos.depth - 1; i >= 0; i--) {
        if ($pos.index(i) > 0) return $pos.doc.resolve($pos.before(i + 1));
        if ($pos.node(i).type.spec.isolating) break;
    }
    return null;
}

function deleteBarrier(state, $cut, dispatch, dir) {
    // if (DEBUG) console.log('deleteBarrier', $cut, $cut.nodeBefore?.toString(), $cut.nodeAfter?.toString(), $cut.toString());

    let before = $cut.nodeBefore, after = $cut.nodeAfter;
    let isolated = before.type.spec.isolating || after.type.spec.isolating;
    if (!isolated) {
        let before = $cut.nodeBefore, after = $cut.nodeAfter, index = $cut.index();
        if (before && after && before.type.compatibleContent(after.type)) {
            // if (DEBUG) console.log('compatible', before.type.contentMatch.next.map(x => x.type.name), after.type.contentMatch.next.map(x => x.type.name));
            return false;
        }
    }

    let canDelAfter = !isolated && $cut.parent.canReplace($cut.index(), $cut.index() + 1);
    if (!canDelAfter) return false;
    let tr = doJoin(state.tr, $cut)

    if (dispatch && tr !== null) {
        dispatch(tr.scrollIntoView());
        return true;
    }

    return false;
}

function doJoin(tr, $cut) {
    if (DEBUG) console.log('doJoin', tr.steps.length, $cut);

    const extraMerge = true;

    let before = $cut.nodeBefore, after = $cut.nodeAfter;

    let match = before.contentMatchAt(before.childCount);
    let conn = match.findWrapping(after.type);
    if (!conn) return null;
    // if (DEBUG) console.log('match:', match.next.map(x => x.type.name), '.matchType(', conn[0]?.name, '||', after.type.name, ')');

    if (!match.matchType(conn[0] || after.type).validEnd) return null;

    if (DEBUG) console.log('wrap', conn.map(x => x.name));

    let end = $cut.pos + after.nodeSize, wrap = Fragment.empty;
    for (let i = conn.length - 1; i >= 0; i--)
        wrap = Fragment.from(conn[i].create(null, wrap));
    wrap = Fragment.from(before.copy(wrap));
    tr.step(new ReplaceAroundStep($cut.pos - 1, end, $cut.pos, end, new Slice(wrap, 1, 0), conn.length, true));
    let posAfter = end + 2 * conn.length;
    if (extraMerge) {
        let pos = $cut.pos - 1;
        let depth = 1 + conn.length;
        let steps = tr.steps.length
        let mapping = tr.mapping.slice(steps);
        let start = mapping.map(pos - depth);
        let end = mapping.map(pos + depth, -1);

        let $start = tr.doc.resolve(start);
        let $end = tr.doc.resolve(end);

        if ($start.parent && $end.parent && $start.parent.type.compatibleContent($end.parent.type)) {
            tr.step(new ReplaceStep(start, end, Slice.empty, true));
        } else {
            let $pos = findCutBefore(tr.doc.resolve(end));
            if ($pos) {
                doJoin(tr, $pos);
            }
        }
        posAfter = tr.mapping.slice(steps).map(posAfter);
    }
    let $joinAt = tr.doc.resolve(posAfter);
    if ($joinAt.nodeAfter && $joinAt.nodeAfter.type === before.type &&
        canJoin(tr.doc, $joinAt.pos)) tr.join($joinAt.pos);
    return tr
}

/**
 * Exact copy of joinBackward from prosemirror-commands
 * If the selection is empty and at the start of a textblock, try to
 * reduce the distance between that block and the one before it—if
 * there's a block directly before it that can be joined, join them.
 * If not, try to move the selected block closer to the next one in
 * the document structure by lifting it out of its parent or moving it
 * into a parent of the previous block.
 */
function customJoinBackward(schema) {
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

            // Check if we're in a list item and try to lift it first
            const grandparent = $from.node($from.depth - 1);
            if (grandparent && grandparent.type === schema.nodes.list_item) {
                // if (DEBUG) console.log('in list item, trying liftListItem');
                if (liftListItem(schema.nodes.list_item)(state, dispatch)) {
                    return true;
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
