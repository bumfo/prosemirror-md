import {inputRules, textblockTypeInputRule, InputRule} from 'prosemirror-inputrules';
import {markdownSchema} from '../markdown/schema.js';
import {canJoin, findWrapping} from 'prosemirror-transform';

/**
 * Markdown input rules for automatic formatting
 * Enables smart conversion of markdown syntax to rich text as users type
 */

/**
 * Build an input rule for automatically wrapping a textblock when a given string is typed
 * Enhanced version that joins with both preceding and following nodes of the same type
 * @param {RegExp} regexp - Regular expression pattern, usually starting with `^` for textblock start
 * @param {import('prosemirror-model').NodeType} nodeType - Node type to wrap content in
 * @param {object|function} [getAttrs] - Static attributes or function to compute them from match
 * @param {function} [joinPredicate] - Function to determine if nodes should be joined
 * @returns {InputRule} Input rule instance
 */
function wrappingInputRule(regexp, nodeType, getAttrs = null, joinPredicate) {
    return new InputRule(regexp, (state, match, start, end) => {
        let attrs = getAttrs instanceof Function ? getAttrs(match) : getAttrs;
        let tr = state.tr.delete(start, end);
        let $start = tr.doc.resolve(start), range = $start.blockRange(),
            wrapping = range && findWrapping(range, nodeType, attrs);
        if (!wrapping)
            return null;
        tr.wrap(range, wrapping);
        
        // Try to join with node before
        let before = tr.doc.resolve(start - 1).nodeBefore;
        if (before && before.type === nodeType && canJoin(tr.doc, start - 1) &&
            (!joinPredicate || joinPredicate(match, before)))
            tr.join(start - 1);
        
        // Try to join with node after
        // Need to recalculate position after potential join before
        let afterPos = tr.doc.resolve(start).end();
        if (afterPos < tr.doc.content.size) {
            let after = tr.doc.resolve(afterPos + 1).nodeAfter;
            if (after && after.type === nodeType && canJoin(tr.doc, afterPos) &&
                (!joinPredicate || joinPredicate(match, after)))
                tr.join(afterPos);
        }
        
        return tr;
    });
}

/**
 * Create an input rule that applies a mark when text matches a pattern
 * @param {RegExp} regexp - Regular expression with capture groups
 * @param {import('prosemirror-model').MarkType} markType - Mark type to apply
 * @param {function} [getAttrs] - Function to get attributes from match
 * @returns {InputRule} Input rule instance
 */
function markInputRule(regexp, markType, getAttrs) {
    return new InputRule(regexp, (state, match, start, end) => {
        const attrs = getAttrs ? getAttrs(match) : null;
        const tr = state.tr;

        if (match[1]) {
            const textStart = start + match[0].indexOf(match[1]);
            const textEnd = textStart + match[1].length;

            if (textEnd < end) tr.delete(textEnd, end);
            if (textStart > start) tr.delete(start, textStart);

            end = start + match[1].length;
        }

        tr.addMark(start, end, markType.create(attrs));
        tr.removeStoredMark(markType);

        return tr;
    });
}

/**
 * Build input rules for markdown editing
 * @param {import('prosemirror-model').Schema} schema - ProseMirror schema
 * @returns {import('prosemirror-inputrules').InputRulesPlugin} Input rules plugin
 */
export function buildInputRules(schema) {
    const rules = [];

    // Heading input rules (# to ######)
    for (let i = 1; i <= 6; i++) {
        rules.push(textblockTypeInputRule(
            new RegExp(`^#{${i}}\\s$`),
            schema.nodes.heading,
            {level: i}
        ));
    }

    // Blockquote input rule (> )
    rules.push(wrappingInputRule(
        /^\s*>\s$/,
        schema.nodes.blockquote
    ));

    // Bullet list input rules (-, *, +)
    rules.push(wrappingInputRule(
        /^\s*([-*+])\s$/,
        schema.nodes.bullet_list
    ));

    // Ordered list input rule (1. )
    rules.push(wrappingInputRule(
        /^\s*(\d+)\.\s$/,
        schema.nodes.ordered_list
    ));

    // Code block input rule (```)
    rules.push(textblockTypeInputRule(
        /^```$/,
        schema.nodes.code_block
    ));

    // Horizontal rule input rules (---, ***, ___)
    rules.push(new InputRule(
        /^(---|\*\*\*|___)$/,
        (state, match, start, end) => {
            const tr = state.tr;
            tr.replaceWith(start - 1, end, schema.nodes.horizontal_rule.create());
            return tr;
        }
    ));

    // Bold input rules (**text** and __text__)
    rules.push(markInputRule(
        /\*\*([^*]+)\*\*$/,
        schema.marks.strong
    ));
    rules.push(markInputRule(
        /__([^_]+)__$/,
        schema.marks.strong
    ));

    // Italic input rules (*text* and _text_)
    // Note: More restrictive to avoid conflicts with bold
    rules.push(markInputRule(
        /\*([^*\s][^*]*[^*\s])\*$/,
        schema.marks.em
    ));
    rules.push(markInputRule(
        /_([^_\s][^_]*[^_\s])_$/,
        schema.marks.em
    ));

    // Code input rule (`text`)
    rules.push(markInputRule(
        /`([^`]+)`$/,
        schema.marks.code
    ));

    return inputRules({rules});
}

/**
 * Build input rules using the default markdown schema
 * @returns {import('prosemirror-inputrules').InputRulesPlugin} Input rules plugin
 */
export function createInputRules() {
    return buildInputRules(markdownSchema);
}
