import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { Node, Mark, NodeType, MarkType } from 'prosemirror-model';
import { Schema } from 'prosemirror-model';

/**
 * Pre-computed state context to avoid redundant computations across menu items
 */
export class StateContext {
    /** Resolved position at selection start */
    readonly $from: any;
    /** Resolved position at selection end */
    readonly $to: any;
    /** Parent node of selection */
    readonly parentNode: Node;
    /** Type of parent node */
    readonly parentType: NodeType;
    /** Attributes of parent node */
    readonly parentAttrs: Record<string, any>;
    /** Node selection (if any) */
    readonly nodeSelection: Node | null;
    /** Whether selection is at block end */
    readonly selectionAtBlockEnd: boolean;
    /** Marks at position for empty selections */
    readonly marksAtPosition: Mark[] | null;
    /** Marks present throughout entire selection */
    readonly selectionMarks: Mark[] | null;
    /** Whether selection is empty */
    readonly empty: boolean;
    /** Selection start position */
    readonly from: number;
    /** Selection end position */
    readonly to: number;
    /** Editor state reference */
    readonly state: EditorState;

    constructor(state: EditorState);

    /**
     * Check if a mark is active in current selection
     */
    isMarkActive(markType: MarkType): boolean;

    /**
     * Check if a block type is active with optional attributes
     */
    isBlockActive(nodeType: NodeType, attrs?: Record<string, any>): boolean;

    private computeSelectionMarks(state: EditorState, from: number, to: number): Mark[];
}

/**
 * Icon specification for menu items
 */
export interface IconSpec {
    /** Text content for text-based icons */
    text?: string;
    /** CSS styles for text icons */
    css?: string;
    /** HTML content for the icon (legacy support) */
    html?: string;
}

/**
 * Command function type for menu items
 */
export type CommandFn = (state: EditorState, dispatch?: (tr: any) => void, view?: EditorView, event?: Event) => boolean;

/**
 * Selection function for visibility checking
 */
export type SelectFn = (state: EditorState, context: StateContext) => boolean;

/**
 * Enable function for enabled state checking
 */
export type EnableFn = (state: EditorState, context: StateContext) => boolean;

/**
 * Active state function for active state checking
 */
export type ActiveFn = (state: EditorState, context: StateContext) => boolean;

/**
 * Title function for dynamic titles
 */
export type TitleFn = (state: EditorState) => string;

/**
 * Menu item specification object
 */
export interface MenuItemSpec {
    /** Command to execute when clicked */
    run: CommandFn;
    /** Function to check if item should be enabled */
    enable?: EnableFn;
    /** Function to check if item should show as active */
    active?: ActiveFn;
    /** Function to check if item should be visible */
    select?: SelectFn;
    /** Icon specification or HTML string */
    icon?: IconSpec | string;
    /** Text label for the item */
    label?: string;
    /** Tooltip text (can be function of state) */
    title?: string | TitleFn;
    /** Additional CSS class */
    class?: string;
    /** Additional CSS styles */
    css?: string;
}

/**
 * Rendered menu item result
 */
export interface RenderedMenuItem {
    /** DOM element for the menu item */
    dom: HTMLElement;
    /** Update function called on state changes */
    update: (state: EditorState, context: StateContext) => boolean;
}

/**
 * Menu item class implementing the MenuElement interface
 */
export class MenuItem {
    readonly spec: MenuItemSpec;

    constructor(spec: MenuItemSpec);

    /**
     * Render the menu item into DOM
     */
    render(view: EditorView): RenderedMenuItem;
}

/**
 * Rendered group result
 */
export interface RenderedGroup {
    /** DOM element containing the group */
    dom: DocumentFragment;
    /** Update function for the group */
    update: (state: EditorState, context: StateContext) => boolean;
}

/**
 * Menu view class managing the entire toolbar
 */
export class MenuView {
    /** Menu items arranged in groups */
    readonly items: MenuItem[][];
    /** Editor view reference */
    readonly editorView: EditorView;
    /** Root DOM element */
    readonly dom: HTMLElement;
    /** Content update function */
    private contentUpdate: (state: EditorState, context: StateContext) => boolean;

    constructor(items: MenuItem[][], editorView: EditorView);

    /**
     * Update menu state
     */
    update(): void;

    /**
     * Destroy menu and clean up DOM
     */
    destroy(): void;
}

/**
 * Helper function to create menu items with keyboard shortcuts
 */
export function menuItem(
    icon: IconSpec | string,
    title: string,
    command: CommandFn,
    isActive?: ActiveFn | null,
    shortcut?: string | null,
    isEnabled?: EnableFn | null
): MenuItem;

/**
 * Custom toggle mark command that aligns with active state logic
 */
export function customToggleMark(markType: MarkType): CommandFn;

/**
 * Context-aware helper function to check if a mark is active
 */
export function markActive(markType: MarkType): ActiveFn;

/**
 * Context-aware helper function to check if a block type is active
 */
export function blockActive(nodeType: NodeType, attrs?: Record<string, any>): ActiveFn;

/**
 * Menu item utility options for marks
 */
export interface MarkItemOptions {
    /** Icon specification */
    icon?: IconSpec | string;
    /** Text label */
    label?: string;
    /** Tooltip text */
    title?: string | TitleFn;
    /** Additional CSS class */
    class?: string;
    /** Additional CSS styles */
    css?: string;
}

/**
 * Menu item utility options for block types
 */
export interface BlockTypeItemOptions extends MarkItemOptions {
    /** Node attributes */
    attrs?: Record<string, any>;
}

/**
 * Menu item utility options for wrap items
 */
export interface WrapItemOptions extends MarkItemOptions {
    /** Node attributes */
    attrs?: Record<string, any>;
}

/**
 * Create menu item for toggling a mark (bold, italic, code, etc.)
 */
export function markItem(markType: MarkType, options: MarkItemOptions): MenuItem;

/**
 * Create menu item for setting block type (paragraph, headings, etc.)
 */
export function blockTypeItem(nodeType: NodeType, options: BlockTypeItemOptions): MenuItem;

/**
 * Create menu item for wrapping selection in a node (blockquote, lists)
 */
export function wrapItem(nodeType: NodeType, options: WrapItemOptions): MenuItem;

/**
 * Create menu items for a schema
 */
export function createMenuItems(schema: Schema): MenuItem[][];

/**
 * Create keyboard shortcuts map
 */
export function createKeymap(schema: Schema): any;

/**
 * Create the menu plugin
 */
export function menuPlugin(schema: Schema): any;

/**
 * Render grouped menu elements with separators
 */
export function renderGrouped(view: EditorView, content: MenuItem[][]): RenderedGroup;

/**
 * Combine multiple update functions into one
 */
export function combineUpdates(
    updates: Array<(state: EditorState, context: StateContext) => boolean>,
    nodes: HTMLElement[]
): (state: EditorState, context: StateContext) => boolean;

/**
 * Utility function to toggle CSS classes
 */
export function setClass(dom: HTMLElement, cls: string, on: boolean): void;