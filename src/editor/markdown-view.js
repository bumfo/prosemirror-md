/**
 * Simple markdown view using a textarea element
 * Provides raw markdown editing experience
 */
export class MarkdownView {
    constructor(target, content = '') {
        this.target = target;
        this.textarea = null;
        this.init(content);
    }
    
    init(content) {
        // Clear the target container
        this.target.innerHTML = '';
        
        // Create textarea element
        this.textarea = document.createElement('textarea');
        this.textarea.className = 'markdown-textarea';
        this.textarea.value = content;
        this.textarea.spellcheck = false;
        
        // Set textarea attributes for better UX
        this.textarea.setAttribute('data-gramm', 'false'); // Disable Grammarly
        this.textarea.setAttribute('data-gramm_editor', 'false');
        this.textarea.setAttribute('data-enable-grammarly', 'false');
        
        // Add event listeners
        this.setupEventListeners();
        
        // Append to target
        this.target.appendChild(this.textarea);
        
        // Auto-resize functionality
        this.updateHeight();
    }
    
    setupEventListeners() {
        // Auto-resize on input
        this.textarea.addEventListener('input', () => {
            this.updateHeight();
        });
        
        // Handle tab insertion
        this.textarea.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                this.insertTab();
            }
        });
    }
    
    insertTab() {
        const start = this.textarea.selectionStart;
        const end = this.textarea.selectionEnd;
        
        // Insert tab character
        const value = this.textarea.value;
        this.textarea.value = value.substring(0, start) + '    ' + value.substring(end);
        
        // Restore cursor position
        this.textarea.selectionStart = this.textarea.selectionEnd = start + 4;
    }
    
    updateHeight() {
        // Auto-resize textarea to fit content
        this.textarea.style.height = 'auto';
        this.textarea.style.height = Math.max(300, this.textarea.scrollHeight) + 'px';
    }
    
    getContent() {
        return this.textarea ? this.textarea.value : '';
    }
    
    setContent(content) {
        if (this.textarea) {
            this.textarea.value = content;
            this.updateHeight();
        }
    }
    
    focus() {
        if (this.textarea) {
            this.textarea.focus();
        }
    }
    
    destroy() {
        if (this.textarea) {
            this.textarea.remove();
            this.textarea = null;
        }
    }
    
    // Get cursor position for potential future features
    getCursorPosition() {
        return this.textarea ? this.textarea.selectionStart : 0;
    }
    
    // Set cursor position
    setCursorPosition(position) {
        if (this.textarea) {
            this.textarea.selectionStart = this.textarea.selectionEnd = position;
            this.textarea.focus();
        }
    }
}