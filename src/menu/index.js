/**
 * Menu system exports
 * 
 * Generic menu components for ProseMirror editors
 */

// Core menu classes and utilities
export {
    MenuItem,
    MenuView,
    StateContext,
    renderGrouped,
    combineUpdates,
    setClass
} from './menu.js';

// Command helpers
export {
    customToggleMark,
    markActive,
    blockActive
} from './menu.js';

// Utility factories
export {
    markItem,
    blockTypeItem,
    wrapItem
} from './menu.js';

// Plugin
export { menuBar } from './menubar.js';

// Icons
export { icons } from './icons.js';