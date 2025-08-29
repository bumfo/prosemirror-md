/**
 * List-specific commands and utilities for ProseMirror
 *
 * This module provides enhanced list editing commands that handle complex scenarios
 * like multi-paragraph list items, nested lists, and intelligent lifting/sinking behavior.
 *
 * @module list_commands
 */

import { liftListItem, sinkListItem } from 'prosemirror-schema-list';
import { canJoin, canSplit, liftTarget, ReplaceAroundStep } from 'prosemirror-transform';
import { Fragment, NodeRange, Slice } from 'prosemirror-model';
import { cmd, funcToCommand, mapping } from './util.js';

/**
 * @typedef {import('prosemirror-model').Schema} Schema
 * @typedef {import('prosemirror-model').NodeType} NodeType
 * @typedef {import('prosemirror-model').ResolvedPos} ResolvedPos
 * @typedef {import('prosemirror-transform').Transform} Transform
 * @typedef {import('./types.d.ts').Transaction} Transaction
 * @typedef {import('./types.d.ts').Command} Command
 * @typedef {import('./types.d.ts').EditorState} EditorState
 */

// ============================================================================
// Configuration
// ============================================================================

/**
 * Debug flag for command logging
 * Set to true to enable detailed logging of list operations
 */
const DEBUG = false;

// ============================================================================
// Public Commands
// ============================================================================

/**
 * Handle backspace behavior within lists
 *
 * This command provides intelligent backspace behavior for lists:
 * - Lifts second+ paragraphs in multi-paragraph list items
 * - Lifts entire list items when appropriate
 * - Preserves list structure when possible
 *
 * @param {NodeType} itemType - The list_item node type from the schema
 * @returns {Command} ProseMirror command for list backspace handling
 */
export function backspaceList(itemType) {
    return funcToCommand((tr) => {
        if (DEBUG) console.log('backspaceList');

        let { $from, $to } = tr.selection;
        let range = getListRange($from, $to, itemType);

        if (!range) return false;

        // Try to lift paragraph from multi-paragraph list item first
        if (liftListParagraphFunc(tr, range, itemType)) {
            return true;
        }

        // Fall back to lifting the entire list item out
        return liftOutOfListFunc(tr, range);
    });
}

/**
 * Custom sink list item command that preserves multi-paragraph structure
 *
 * This command wraps the standard sinkListItem with additional logic to:
 * - Skip sinking when cursor is in second+ paragraph of multi-paragraph list item
 * - Preserve document structure and prevent unintended nesting
 *
 * @param {Schema} schema - ProseMirror schema
 * @returns {Command} Custom sink list item command
 */
export function customSinkListItem(schema) {
    const itemType = schema.nodes.list_item;
    const paragraphType = schema.nodes.paragraph;
    const sinkListCommand = sinkListItem(itemType);

    return cmd((state, dispatch, view) => {
        // Check if we should skip sinking (multi-paragraph case)
        if (!isFirstParagraphInListItem(state, itemType, paragraphType)) {
            if (DEBUG) console.log('Skipping sink: not in first paragraph of list item');
            return false;
        }

        // Use standard sinkListItem behavior
        return sinkListCommand(state, dispatch, view);
    });
}

/**
 * Custom lift list item command with enhanced multi-paragraph support
 *
 * This command provides intelligent lifting behavior that:
 * - Handles multi-paragraph list items by lifting individual paragraphs when appropriate
 * - Falls back to standard list item lifting for single-paragraph items
 * - Chooses between lifting to outer list or completely out of list based on context
 *
 * @param {Schema} schema - ProseMirror schema
 * @param {boolean} allowLiftOut - Whether to lift out completely
 * @returns {Command} Custom lift list item command
 */
export function customLiftListItem(schema, allowLiftOut = false) {
    const itemType = schema.nodes.list_item;

    return funcToCommand((tr) => {
        let { $from, $to } = tr.selection;
        let range = getListRange($from, $to, itemType);

        if (!range) return false;

        // Try to lift paragraph from multi-paragraph list item first
        if (liftListParagraphFunc(tr, range, itemType)) {
            return true;
        }

        if (allowLiftOut) {
            // Fall back to standard list item lifting
            return liftListItemFunc(tr, range, itemType);
        } else {
            // Check if we're inside a nested list
            if (range.$from.node(range.depth - 1).type === itemType) {
                // Inside a parent list item - lift to outer list
                return liftToOuterListFunc(tr, itemType, range);
            } else {
                // At the top level of a list - do nothing
                return true;
            }    
        }
    });
}

// ============================================================================
// Helper Functions - List Structure Analysis
// ============================================================================

/**
 * Get the block range for list operations
 *
 * Finds the range that encompasses the current selection within a list structure,
 * using a predicate that identifies list nodes containing list items.
 *
 * @param {ResolvedPos} $from - Start position of selection
 * @param {ResolvedPos} $to - End position of selection
 * @param {NodeType} itemType - The list_item node type
 * @returns {NodeRange|null} Range encompassing the list structure, or null if not in list
 */
function getListRange($from, $to, itemType) {
    let listPredicate = node => node.childCount > 0 && node.firstChild.type === itemType;
    return $from.blockRange($to, listPredicate);
}

/**
 * Check if cursor is in the first paragraph of a (potentially multi-paragraph) list item
 *
 * Used to determine whether sink/lift operations should be allowed based on cursor position
 * within multi-paragraph list items.
 *
 * @param {EditorState} state - Current editor state
 * @param {NodeType} itemType - The list_item node type
 * @param {NodeType} paragraphType - The paragraph node type
 * @returns {boolean} True if in first paragraph or not in multi-paragraph list item
 */
function isFirstParagraphInListItem(state, itemType, paragraphType) {
    const { $from } = state.selection;

    // Check if we're in a paragraph
    if ($from.parent.type !== paragraphType) {
        return true; // Not in paragraph, allow operation
    }

    // Check if paragraph is within a list item
    const grandparent = $from.node($from.depth - 1);
    if (!grandparent || grandparent.type !== itemType) {
        return true; // Not in list item, allow operation
    }

    // Check if list item has multiple paragraphs
    if (grandparent.childCount <= 1) {
        return true; // Single paragraph list item, allow operation
    }

    // Check if we're in the first paragraph
    const paragraphIndex = $from.index($from.depth - 1);
    if (paragraphIndex > 0) {
        // In second+ paragraph of multi-paragraph list item
        if (DEBUG) console.log('In second+ paragraph of multi-paragraph list item');
        return false;
    }

    return true; // In first paragraph, allow operation
}

// ============================================================================
// Helper Functions - List Transformation
// ============================================================================

/**
 * Split a list item at the given position
 *
 * Attempts to split a list item, typically used before lifting operations
 * to separate paragraphs within multi-paragraph list items.
 *
 * @param {Transform} tr - The transaction to modify
 * @param {number} pos - Position to split at
 * @returns {boolean} True if split was successful
 */
function splitListFunc(tr, pos) {
    let $pos = tr.doc.resolve(pos);

    // Determine the type for the new split node
    let nextType = pos === $pos.end() ? $pos.parent.contentMatchAt(0).defaultType : null;
    let types = nextType ? [null, { type: nextType }] : undefined;

    if (canSplit(tr.doc, pos, 1, types)) {
        tr.split(pos, 1, types);
        return true;
    }
    return false;
}

/**
 * Lift a paragraph from a multi-paragraph list item
 *
 * Handles the complex operation of extracting a paragraph from within a
 * multi-paragraph list item, splitting the item and lifting the paragraph out.
 *
 * @param {Transaction} tr - The transaction to modify
 * @param {NodeRange} range - The list range
 * @param {NodeType} itemType - The list_item node type
 * @returns {boolean} True if paragraph was lifted, false otherwise
 */
function liftListParagraphFunc(tr, range, itemType) {
    let steps = tr.steps.length;
    let { $from } = range;

    // Check if this is a second (or later) paragraph in a list item
    let paragraphIndex = $from.index($from.depth - 1);
    if (paragraphIndex === 0) {
        return false; // First paragraph, don't handle here
    }

    if (DEBUG) console.log('Lifting paragraph from multi-paragraph list item');

    // Split at the paragraph boundary
    let pos = $from.before($from.depth);
    if (!splitListFunc(tr, pos)) {
        if (DEBUG) console.warn('Failed to split list item');
        return true; // Return true to prevent fallback behavior
    }

    // Lift the split paragraph out of the list
    let $pos = tr.doc.resolve(mapping(tr, steps).map(pos));
    let newRange = getListRange($pos, $pos, itemType);
    if (newRange && liftOutOfListFunc(tr, newRange)) {
        return true;
    }

    if (DEBUG) console.warn('Split succeeded but lift failed');
    return true; // Return true to prevent fallback behavior
}

/**
 * Lift list items to an outer list level
 *
 * Moves list items up one level in nested list structures, preserving siblings
 * and properly handling list boundaries.
 *
 * @param {Transform} tr - The transaction to modify
 * @param {NodeType} itemType - The list_item node type
 * @param {NodeRange} range - The range to lift
 * @returns {boolean} True if items were lifted
 */
function liftToOuterListFunc(tr, itemType, range) {
    let steps = tr.steps.length;
    let end = range.end;
    let endOfList = range.$to.end(range.depth);

    // Handle siblings after the lifted items
    if (end < endOfList) {
        // Siblings must become children of the last lifted item
        tr.step(new ReplaceAroundStep(
            end - 1, endOfList, end, endOfList,
            new Slice(Fragment.from(itemType.create(null, range.parent.copy())), 1, 0),
            1, true,
        ));
        range = new NodeRange(
            tr.doc.resolve(range.$from.pos),
            tr.doc.resolve(endOfList),
            range.depth,
        );
    }

    // Find and apply the lift target
    const target = liftTarget(range);
    if (target == null) return false;

    tr.lift(range, target);

    // Try to join adjacent nodes of the same type
    let $after = tr.doc.resolve(mapping(tr, steps).map(end, -1) - 1);
    if (canJoin(tr.doc, $after.pos) &&
        $after.nodeBefore &&
        $after.nodeAfter &&
        $after.nodeBefore.type === $after.nodeAfter.type) {
        tr.join($after.pos);
    }

    return true;
}

/**
 * Lift list items completely out of list structure
 *
 * Removes list items from their containing list, converting them to
 * regular block content at the parent level.
 *
 * @param {Transform} tr - The transaction to modify
 * @param {NodeRange} range - The range to lift out
 * @returns {boolean} True if items were lifted out
 */
function liftOutOfListFunc(tr, range) {
    if (!range) return false;

    let steps = tr.steps.length;
    let list = range.parent;

    // Merge all selected list items into a single item
    for (let pos = range.end, i = range.endIndex - 1, e = range.startIndex; i > e; i--) {
        pos -= list.child(i).nodeSize;
        tr.delete(pos - 1, pos + 1);
    }

    // Validate the merged result
    let $start = tr.doc.resolve(range.start);
    let item = $start.nodeAfter;
    if (!item || mapping(tr, steps).map(range.end) !== range.start + item.nodeSize) {
        return false;
    }

    // Check if we can replace the list structure with the content
    let atStart = range.startIndex === 0;
    let atEnd = range.endIndex === list.childCount;
    let parent = $start.node(-1);
    let indexBefore = $start.index(-1);

    if (!parent.canReplace(
        indexBefore + (atStart ? 0 : 1),
        indexBefore + 1,
        item.content.append(atEnd ? Fragment.empty : Fragment.from(list)),
    )) {
        return false;
    }

    // Strip off the surrounding list structure
    let start = $start.pos;
    let end = start + item.nodeSize;

    tr.step(new ReplaceAroundStep(
        start - (atStart ? 1 : 0),
        end + (atEnd ? 1 : 0),
        start + 1,
        end - 1,
        new Slice(
            (atStart ? Fragment.empty : Fragment.from(list.copy(Fragment.empty)))
                .append(atEnd ? Fragment.empty : Fragment.from(list.copy(Fragment.empty))),
            atStart ? 0 : 1,
            atEnd ? 0 : 1,
        ),
        atStart ? 0 : 1,
    ));

    return true;
}

/**
 * Orchestrate list item lifting based on context
 *
 * Determines the appropriate lifting strategy based on whether the selection
 * is within a nested list or at the top level of a list.
 *
 * @param {Transform} tr - The transaction to modify
 * @param {NodeRange} range - The range to lift
 * @param {NodeType} itemType - The list_item node type
 * @returns {boolean} True if lifting was successful
 */
function liftListItemFunc(tr, range, itemType) {
    if (!range) return false;

    let { $from } = range;

    // Check if we're inside a nested list
    if ($from.node(range.depth - 1).type === itemType) {
        // Inside a parent list item - lift to outer list
        return liftToOuterListFunc(tr, itemType, range);
    } else {
        // At the top level of a list - lift out completely
        return liftOutOfListFunc(tr, range);
    }
}
