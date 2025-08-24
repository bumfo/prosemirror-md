import { ProseMirrorView } from './editor/wysiwyg-view.js';
import { MarkdownView } from './editor/markdown-view.js';

class EditorManager {
    constructor(target, initialContent) {
        this.target = target;
        this.initialContent = initialContent;
        
        // Persistent view instances
        this.wysiwygView = null;
        this.markdownView = null;
        
        // Track active views and layout
        this.activeViews = new Set(['wysiwyg']); // Start with WYSIWYG only
        this.isSyncing = false; // Prevent sync loops
        this.syncTimeouts = new Map(); // Debounce sync operations
        
        // Create containers for views
        this.createViewContainers();
        
        // Initialize with WYSIWYG view
        this.initializeViews();
        
        // Set up view switching listeners
        this.setupViewListeners();
        
        // Update layout
        this.updateLayout();
    }
    
    createViewContainers() {
        // Clear target and create view containers
        this.target.innerHTML = '';
        this.target.className = 'editor-container';
        
        // WYSIWYG container
        this.wysiwygContainer = document.createElement('div');
        this.wysiwygContainer.className = 'editor-pane wysiwyg-pane';
        this.wysiwygContainer.style.display = 'block';
        
        // Markdown container  
        this.markdownContainer = document.createElement('div');
        this.markdownContainer.className = 'editor-pane markdown-pane';
        this.markdownContainer.style.display = 'none';
        
        this.target.appendChild(this.wysiwygContainer);
        this.target.appendChild(this.markdownContainer);
    }
    
    initializeViews() {
        // Create WYSIWYG view (starts active)
        this.wysiwygView = new ProseMirrorView(this.wysiwygContainer, this.initialContent);
        
        // Set up sync listeners
        this.setupSyncListeners();
    }
    
    createMarkdownView() {
        if (!this.markdownView) {
            // Get current content from WYSIWYG
            const content = this.wysiwygView ? this.wysiwygView.getContent() : this.initialContent;
            this.markdownView = new MarkdownView(this.markdownContainer, content);
            
            // Set up sync listeners for new view
            this.setupSyncListeners();
        }
    }
    
    setupSyncListeners() {
        // WYSIWYG → Markdown sync
        if (this.wysiwygView) {
            this.wysiwygView.onContentChange = (content, source) => {
                // Skip sync if content change came from sync operation
                if (source === 'sync') return;
                
                this.debouncedSync('wysiwyg-to-markdown', () => {
                    // Skip sync if composition is active in WYSIWYG view
                    if (this.wysiwygView.isComposing()) {
                        return;
                    }
                    
                    if (this.markdownView && this.activeViews.has('markdown') && !this.isSyncing) {
                        this.isSyncing = true;
                        this.markdownView.setContent(content, { preserveCursor: true, source: 'sync' });
                        this.isSyncing = false;
                    }
                });
            };
        }
        
        // Markdown → WYSIWYG sync
        if (this.markdownView) {
            this.markdownView.onContentChange = (content, source) => {
                // Skip sync if content change came from sync operation
                if (source === 'sync') return;
                
                this.debouncedSync('markdown-to-wysiwyg', () => {
                    // Skip sync if composition is active in markdown view
                    if (this.markdownView.isComposing()) {
                        return;
                    }
                    
                    if (this.wysiwygView && this.activeViews.has('wysiwyg') && !this.isSyncing) {
                        this.isSyncing = true;
                        this.wysiwygView.updateContent(content, { preserveHistory: true, source: 'sync' });
                        this.isSyncing = false;
                    }
                });
            };
        }
    }
    
    debouncedSync(key, callback) {
        // Clear existing timeout
        if (this.syncTimeouts.has(key)) {
            clearTimeout(this.syncTimeouts.get(key));
        }
        
        // Set new timeout for debounced sync
        const timeout = setTimeout(() => {
            callback();
            this.syncTimeouts.delete(key);
        }, 150); // 150ms debounce
        
        this.syncTimeouts.set(key, timeout);
    }
    
    setupViewListeners() {
        const checkboxes = document.querySelectorAll('input[name=\"view\"]');
        
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', () => {
                const viewType = checkbox.getAttribute('data-view');
                
                if (checkbox.checked) {
                    this.activateView(viewType);
                } else {
                    this.deactivateView(viewType);
                }
                
                this.updateLayout();
            });
        });
    }
    
    activateView(viewType) {
        this.activeViews.add(viewType);
        
        if (viewType === 'markdown' && !this.markdownView) {
            this.createMarkdownView();
        }
        
        // Show the view container
        const container = viewType === 'wysiwyg' ? this.wysiwygContainer : this.markdownContainer;
        container.style.display = 'block';
        
        // Sync content when activating
        if (viewType === 'markdown' && this.wysiwygView) {
            const content = this.wysiwygView.getContent();
            if (this.markdownView) {
                this.markdownView.setContent(content);
            }
        }
    }
    
    deactivateView(viewType) {
        // Prevent deactivating all views
        if (this.activeViews.size <= 1) {
            // Re-check the checkbox
            const checkbox = document.querySelector(`input[data-view=\"${viewType}\"]`);
            if (checkbox) checkbox.checked = true;
            return;
        }
        
        this.activeViews.delete(viewType);
        
        // Hide the view container (but don't destroy the view to preserve history)
        const container = viewType === 'wysiwyg' ? this.wysiwygContainer : this.markdownContainer;
        container.style.display = 'none';
    }
    
    updateLayout() {
        const isSideBySide = this.activeViews.size > 1;
        
        if (isSideBySide) {
            this.target.classList.add('editor-split');
            this.target.classList.remove('editor-single');
        } else {
            this.target.classList.add('editor-single');
            this.target.classList.remove('editor-split');
        }
        
        // Focus appropriate view
        this.focusActiveView();
    }
    
    focusActiveView() {
        if (this.activeViews.has('wysiwyg') && this.wysiwygView) {
            this.wysiwygView.focus();
        } else if (this.activeViews.has('markdown') && this.markdownView) {
            this.markdownView.focus();
        }
    }
    
    getCurrentContent() {
        // Return content from WYSIWYG view as primary source
        if (this.wysiwygView) {
            return this.wysiwygView.getContent();
        } else if (this.markdownView) {
            return this.markdownView.getContent();
        }
        return '';
    }
    
    setContent(content) {
        this.isSyncing = true;
        
        if (this.wysiwygView) {
            this.wysiwygView.setContent(content);
        }
        if (this.markdownView) {
            this.markdownView.setContent(content);
        }
        
        this.isSyncing = false;
    }
    
    // Get active view types
    getActiveViews() {
        return Array.from(this.activeViews);
    }
    
    // Check if side-by-side mode is active
    isSideBySideMode() {
        return this.activeViews.size > 1;
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