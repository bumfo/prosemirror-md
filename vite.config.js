import { defineConfig } from 'vite';

export default defineConfig({
    // Base path for GitHub Pages deployment
    base: '/prosemirror-md/',
    
    // Build configuration
    build: {
        // Output directory
        outDir: 'dist',
        
        // Clean output directory before build
        emptyOutDir: true,
        
        // Generate source maps for debugging
        sourcemap: true,
        
        // Modern browser target
        target: 'es2020',
        
        // Rollup options for bundling
        rollupOptions: {
            // Input file
            input: {
                main: './index.html'
            },
            
            // Output configuration
            output: {
                // Chunk naming for better caching
                chunkFileNames: 'assets/[name]-[hash].js',
                entryFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash].[ext]'
            }
        }
    },
    
    // Development server configuration
    server: {
        port: 3001,
        open: true,
        host: true
    },
    
    // Preview server configuration
    preview: {
        port: 4001,
        open: true,
        host: true
    },
    
    // Dependency optimization
    optimizeDeps: {
        // Include ProseMirror dependencies for pre-bundling
        include: [
            'prosemirror-state',
            'prosemirror-view',
            'prosemirror-model',
            'prosemirror-markdown',
            'prosemirror-schema-basic',
            'prosemirror-schema-list',
            'prosemirror-example-setup',
            'prosemirror-keymap',
            'prosemirror-commands',
            'prosemirror-history',
            'prosemirror-inputrules',
            'prosemirror-dropcursor',
            'prosemirror-gapcursor',
            'markdown-it'
        ],
        
        // Force optimization of these dependencies
        force: false
    },
    
    // Plugin configuration
    plugins: [
        // Add custom plugins if needed
    ],
    
    // Define global constants
    define: {
        __DEV__: JSON.stringify(process.env.NODE_ENV === 'development')
    },
    
    // CSS configuration
    css: {
        // PostCSS plugins can be added here if needed
        postcss: {},
        
        // CSS modules configuration
        modules: false,
        
        // CSS preprocessing options
        preprocessorOptions: {}
    },
    
    // Resolve configuration
    resolve: {
        // Path aliases
        alias: {
            '@': '/src'
        }
    },
    
    // Environment variables
    envPrefix: 'VITE_',
    
    // ESBuild configuration
    esbuild: {
        // Target JavaScript version
        target: 'es2020',
        
        // Keep function names for better debugging
        keepNames: true
    }
});