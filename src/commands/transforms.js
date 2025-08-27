import { canJoin, ReplaceAroundStep, ReplaceStep } from 'prosemirror-transform';
import { Fragment, Slice } from 'prosemirror-model';

/**
 * Debug flag for command logging
 */
const DEBUG = false;

// Helper functions from prosemirror-commands (exact copies)
export function atBlockStart(state, view) {
    let { $cursor } = state.selection;
    if (!$cursor || (view ? !view.endOfTextblock('backward', state) : $cursor.parentOffset > 0))
        return null;
    return $cursor;
}

export function findCutBefore($pos) {
    if (!$pos.parent.type.spec.isolating) for (let i = $pos.depth - 1; i >= 0; i--) {
        if ($pos.index(i) > 0) return $pos.doc.resolve($pos.before(i + 1));
        if ($pos.node(i).type.spec.isolating) break;
    }
    return null;
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
        if (after.type.name === 'list_item') {
            depth += 1;
        }

        let steps = tr.steps.length;
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
    return tr;
}

export function customDeleteBarrier(state, $cut, dispatch) {
    // if (DEBUG) console.log('deleteBarrier', $cut, $cut.nodeBefore?.toString(), $cut.nodeAfter?.toString(), $cut.toString());

    let before = $cut.nodeBefore, after = $cut.nodeAfter;
    let isolated = before.type.spec.isolating || after.type.spec.isolating;
    if (!isolated) {
        let before = $cut.nodeBefore, after = $cut.nodeAfter;
        if (before && after && before.type.compatibleContent(after.type)) {
            // if (DEBUG) console.log('compatible', before.type.contentMatch.next.map(x => x.type.name), after.type.contentMatch.next.map(x => x.type.name));
            return false;
        }
    }

    let canDelAfter = !isolated && $cut.parent.canReplace($cut.index(), $cut.index() + 1);
    if (!canDelAfter) return false;
    let tr = doJoin(state.tr, $cut);

    if (dispatch && tr !== null) {
        dispatch(tr.scrollIntoView());
        return true;
    }

    return false;
}
