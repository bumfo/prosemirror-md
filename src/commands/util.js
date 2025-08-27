/**
 * @typedef {import('./types.d.ts').Command} Command
 * @typedef {import('./types.d.ts').Func} Func
 */

/**
 * @param {Command} cmd
 */
export function cmd(cmd) {
    return cmd
}

/**
 * @param {Func} func
 * @param {boolean} scroll
 * @returns {Command | ((state: EditorState, dispatch?: (tr: any) => void, ...args) => boolean)}
 */
export function funcToCommand(func, scroll = true) {
    /**
     * @param {EditorState} state
     * @param {(tr: any) => void} dispatch
     * @param args
     * @returns {boolean}
     */
    function command(state, dispatch, ...args) {
        let tr = state.tr;
        if (!func(tr, ...args)) {
            return false;
        }

        if (dispatch) {
            if (scroll) {
                tr.scrollIntoView();
            }
            dispatch(tr);
        }
        return true;
    }

    return command;
}

/**
 * Get position mapping from transaction
 *
 * Helper to get mapping from a specific step index in the transaction.
 * Used for tracking position changes through multiple transformation steps.
 *
 * @param {Transform} tr - The transaction/transform
 * @param {number} [steps=0] - Number of steps to slice from (0 = all steps)
 * @returns {import('prosemirror-transform').Mapping} Position mapping
 */
export function mapping(tr, steps = 0) {
    if (steps === 0) return tr.mapping;
    return tr.mapping.slice(steps);
}
