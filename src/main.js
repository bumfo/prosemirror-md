import { ProseMirrorView } from './editor/wysiwyg-view.js';
import { MarkdownView } from './editor/markdown-view.js';

class EditorManager {
    constructor(target, initialContent) {
        this.target = target;
        this.currentView = null;
        this.currentMode = 'wysiwyg';
        
        // Initialize with WYSIWYG view
        this.switchToView('wysiwyg', initialContent);
        
        // Set up mode switching
        this.setupModeListeners();
    }
    
    switchToView(mode, content = null) {
        // Get content from current view if switching
        const currentContent = content || (this.currentView ? this.currentView.getContent() : '');
        
        // Destroy current view
        if (this.currentView) {
            this.currentView.destroy();
        }
        
        // Create new view
        const ViewClass = mode === 'wysiwyg' ? ProseMirrorView : MarkdownView;
        this.currentView = new ViewClass(this.target, currentContent);
        this.currentMode = mode;
        
        // Focus the new view
        this.currentView.focus();
    }
    
    setupModeListeners() {
        const radioButtons = document.querySelectorAll('input[name="mode"]');
        
        radioButtons.forEach(button => {
            button.addEventListener('change', () => {
                if (button.checked && button.value !== this.currentMode) {
                    this.switchToView(button.value);
                }
            });
        });
    }
    
    getCurrentContent() {
        return this.currentView ? this.currentView.getContent() : '';
    }
    
    setContent(content) {
        if (this.currentView) {
            this.currentView.setContent(content);
        }
    }
}

// Initialize the editor when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const editorContainer = document.getElementById('editor');
    const initialContent = document.getElementById('initial-content').value;
    
    if (editorContainer) {
        const editor = new EditorManager(editorContainer, initialContent);
        
        // Make editor globally available for debugging
        window.editor = editor;
        
        console.log('ProseMirror Markdown Editor initialized');
    } else {
        console.error('Editor container not found');
    }
});

export { EditorManager };