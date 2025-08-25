import { EditorState, Plugin, PluginKey } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import { history } from 'prosemirror-history';
import { keymap } from 'prosemirror-keymap';
import { baseKeymap } from 'prosemirror-commands';
import { dropCursor } from 'prosemirror-dropcursor';
import { gapCursor } from 'prosemirror-gapcursor';
import { markdownSchema } from '../markdown/schema.js';
import { parseMarkdown } from '../markdown/parser.js';
import { serializeMarkdown } from '../markdown/serializer.js';
import { menuPlugin, createKeymap } from './menu.js';
import { createInputRules } from './inputrules.js';

/**
 * ProseMirror-based WYSIWYG view for markdown editing
 * Provides rich text editing with markdown serialization
 */
export class ProseMirrorView {
    constructor(target, content = '') {
        this.target = target;
        this.view = null;
        this.init(content);
    }
    
    init(content) {
        // Clear the target container
        this.target.innerHTML = '';
        
        // Parse initial markdown content
        let doc;
        try {
            doc = parseMarkdown(content || '# Welcome\n\nStart editing...');
        } catch (error) {
            console.warn('Failed to parse markdown, using default:', error);
            doc = markdownSchema.node('doc', null, [
                markdownSchema.node('heading', { level: 1 }, [markdownSchema.text('Welcome')]),
                markdownSchema.node('paragraph', null, [markdownSchema.text('Start editing...')])
            ]);
        }
        
        // Create editor state with custom plugins
        const state = EditorState.create({
            doc,
            plugins: [
                // Core editing plugins
                history(),
                keymap(baseKeymap),
                dropCursor(),
                gapCursor(),
                
                // Markdown input rules for smart typing
                createInputRules(),
                
                // Custom keyboard shortcuts
                createKeymap(markdownSchema),
                
                // Custom menu plugin
                menuPlugin(markdownSchema),
                
                // Custom styling plugin for markdown-like appearance
                this.createMarkdownStylingPlugin()
            ]
        });
        
        // Create editor view
        this.view = new EditorView(this.target, {
            state,
            // Custom node views for enhanced markdown editing
            nodeViews: this.getNodeViews(),
            // Handle various editor events
            dispatchTransaction: this.dispatchTransaction.bind(this)
        });
        
        // Add CSS class for styling
        this.target.classList.add('prosemirror-wysiwyg');
    }
    
    createMarkdownStylingPlugin() {
        // Plugin to make the WYSIWYG view look more like rendered markdown
        return new Plugin({
            key: new PluginKey('markdownStyling'),
            props: {
                attributes: {
                    class: 'markdown-wysiwyg'
                }
            }
        });
    }
    
    getNodeViews() {
        return {
            // Custom node views can be added here for special rendering
            // For example, custom image rendering, code block syntax highlighting, etc.
        };
    }
    
    dispatchTransaction(transaction) {
        const newState = this.view.state.apply(transaction);
        this.view.updateState(newState);
        
        // Emit custom events for content changes
        if (transaction.docChanged) {
            // Get source from transaction metadata
            const source = transaction.getMeta('source');
            
            // Call content change callback if set
            if (this.onContentChange && typeof this.onContentChange === 'function') {
                this.onContentChange(this.getContent(), source);
            }
            
            this.target.dispatchEvent(new CustomEvent('content-changed', {
                detail: { content: this.getContent(), source }
            }));
        }
    }
    
    getContent() {
        if (!this.view) return '';
        
        try {
            return serializeMarkdown(this.view.state.doc);
        } catch (error) {
            console.error('Failed to serialize document:', error);
            return '';
        }
    }
    
    setContent(content) {
        if (!this.view) return;
        
        try {
            const doc = parseMarkdown(content);
            const state = EditorState.create({
                doc,
                plugins: this.view.state.plugins
            });
            this.view.updateState(state);
        } catch (error) {
            console.error('Failed to parse and set content:', error);
        }
    }
    
    updateContent(content, options = {}) {
        if (!this.view) return;
        
        try {
            const doc = parseMarkdown(content);
            
            if (options.preserveHistory) {
                // Replace the entire document while preserving history
                const tr = this.view.state.tr;
                tr.replaceWith(0, this.view.state.doc.content.size, doc.content);
                
                // Add source metadata to prevent feedback loops
                if (options.source) {
                    tr.setMeta('source', options.source);
                }
                
                this.view.dispatch(tr);
            } else {
                // Create new state (this will reset history)
                const state = EditorState.create({
                    doc,
                    plugins: this.view.state.plugins
                });
                this.view.updateState(state);
            }
        } catch (error) {
            console.error('Failed to update content:', error);
        }
    }
    
    focus() {
        if (this.view) {
            this.view.focus();
        }
    }
    
    destroy() {
        if (this.view) {
            this.view.destroy();
            this.view = null;
        }
        this.target.classList.remove('prosemirror-wysiwyg');
    }
    
    // Get the underlying ProseMirror view for advanced usage
    getProseMirrorView() {
        return this.view;
    }
    
    // Get current document as ProseMirror node
    getDocument() {
        return this.view ? this.view.state.doc : null;
    }
    
    // Execute a command
    executeCommand(command) {
        if (this.view && command) {
            return command(this.view.state, this.view.dispatch, this.view);
        }
        return false;
    }
    
    // Check if composition is active (for IME input)
    isComposing() {
        return this.view ? this.view.composing : false;
    }
}

