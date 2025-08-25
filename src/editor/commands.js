import {
    canJoin,
    liftTarget,
    ReplaceAroundStep,

} from 'prosemirror-transform';
import { Selection } from 'prosemirror-state';
import { Slice, Fragment } from 'prosemirror-model';
import { lift, joinBackward, selectNodeBackward } from 'prosemirror-commands';
import { liftListItem } from 'prosemirror-schema-list';

/**
 * Debug flag for command logging
 */
const DEBUG = true;

/**
 * Check if cursor is at the start of a block (legacy version)
 * @param {import('prosemirror-state').EditorState} state - Editor state
 * @returns {boolean} True if at block start
 */
function atBlockStartOld(state) {
    const { $from, to } = state.selection;
    return to <= $from.end() && $from.parentOffset === 0;
}

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

function textblockAt(node, side, only = false) {
    for (let scan = node; scan; scan = (side === 'start' ? scan.firstChild : scan.lastChild)) {
        if (scan.isTextblock) return true;
        if (only && scan.childCount !== 1) return false;
    }
    return false;
}

function joinMaybeClear(state, $pos, dispatch) {
    let before = $pos.nodeBefore, after = $pos.nodeAfter, index = $pos.index();
    if (!before || !after || !before.type.compatibleContent(after.type)) return false;
    if (!before.content.size && $pos.parent.canReplace(index - 1, index)) {
        if (dispatch) dispatch(state.tr.delete($pos.pos - before.nodeSize, $pos.pos).scrollIntoView());
        return true;
    }
    if (!$pos.parent.canReplace(index, index + 1) || !(after.isTextblock || canJoin(state.doc, $pos.pos)))
        return false;
    if (dispatch)
        dispatch(state.tr.join($pos.pos).scrollIntoView());
    return true;
}

function deleteBarrier(state, $cut, dispatch, dir) {
    if (DEBUG) console.log('deleteBarrier');

    let before = $cut.nodeBefore, after = $cut.nodeAfter, conn, match;
    let isolated = before.type.spec.isolating || after.type.spec.isolating;
    if (!isolated && joinMaybeClear(state, $cut, dispatch)) return true;

    let canDelAfter = !isolated && $cut.parent.canReplace($cut.index(), $cut.index() + 1);
    if (canDelAfter &&
        (conn = (match = before.contentMatchAt(before.childCount)).findWrapping(after.type)) &&
        match.matchType(conn[0] || after.type).validEnd) {
        if (dispatch) {
            let end = $cut.pos + after.nodeSize, wrap = Fragment.empty;
            for (let i = conn.length - 1; i >= 0; i--)
                wrap = Fragment.from(conn[i].create(null, wrap));
            wrap = Fragment.from(before.copy(wrap));
            let tr = state.tr.step(new ReplaceAroundStep($cut.pos - 1, end, $cut.pos, end, new Slice(wrap, 1, 0), conn.length, true));
            let $joinAt = tr.doc.resolve(end + 2 * conn.length);
            if ($joinAt.nodeAfter && $joinAt.nodeAfter.type === before.type &&
                canJoin(tr.doc, $joinAt.pos)) tr.join($joinAt.pos);
            dispatch(tr.scrollIntoView());
        }
        return true;
    }

    let selAfter = after.type.spec.isolating || (dir > 0 && isolated) ? null : Selection.findFrom($cut, 1);
    let range = selAfter && selAfter.$from.blockRange(selAfter.$to), target = range && liftTarget(range);
    if (target != null && target >= $cut.depth) {
        if (dispatch) dispatch(state.tr.lift(range, target).scrollIntoView());
        return true;
    }

    if (canDelAfter && textblockAt(after, 'start', true) && textblockAt(before, 'end')) {
        let at = before, wrap = [];
        for (; ;) {
            wrap.push(at);
            if (at.isTextblock) break;
            at = at.lastChild;
        }
        let afterText = after, afterDepth = 1;
        for (; !afterText.isTextblock; afterText = afterText.firstChild) afterDepth++;
        if (at.canReplace(at.childCount, at.childCount, afterText.content)) {
            if (dispatch) {
                let end = Fragment.empty;
                for (let i = wrap.length - 1; i >= 0; i--) end = Fragment.from(wrap[i].copy(end));
                let tr = state.tr.step(new ReplaceAroundStep($cut.pos - wrap.length, $cut.pos + after.nodeSize,
                    $cut.pos + afterDepth, $cut.pos + after.nodeSize - afterDepth,
                    new Slice(end, wrap.length, 0), 0, true));
                dispatch(tr.scrollIntoView());
            }
            return true;
        }
    }

    return false;
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
    return (state, dispatch) => {
        if (!state.selection.empty) {
            return false;
        }

        const atStart = atBlockStartOld(state);

        // Only handle if at block start
        if (!atStart) {
            if (DEBUG) console.log('skip not atStart');
            return false;
        }

        const { $from } = state.selection;
        const parent = $from.parent;

        // If already a paragraph, try various backspace behaviors
        if (parent.type === schema.nodes.paragraph) {
            if (DEBUG) console.log('already paragraph');

            // Check if we're in a list item and try to lift it first
            const grandparent = $from.node($from.depth - 1);
            if (grandparent && grandparent.type === schema.nodes.list_item) {
                if (DEBUG) console.log('in list item, trying liftListItem');
                if (liftListItem(schema.nodes.list_item)(state, dispatch)) {
                    return true;
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
