import { Transaction } from 'prosemirror-state';

export type Func = (
    tr: Transaction,
    ...args: any[]
) => boolean;

export type { Command } from "prosemirror-state";
export type { EditorState, Transaction } from 'prosemirror-state';
export type { EditorView } from "prosemirror-view";
export type { ResolvedPos } from "prosemirror-model";
export type { Transform } from "prosemirror-transform";
