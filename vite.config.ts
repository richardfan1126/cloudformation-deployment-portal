import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    define: {
        global: 'globalThis',
    },
    resolve: {
        alias: {
            './runtimeConfig': './runtimeConfig.browser',
        },
    },
    optimizeDeps: {
        exclude: ['@aws-amplify/backend', '@aws-amplify/backend-cli']
    },
    build: {
        rollupOptions: {
            onwarn(warning, warn) {
                // Suppress warnings about unresolved imports from AWS Amplify
                if (warning.code === 'UNRESOLVED_IMPORT' && warning.source?.includes('@aws-amplify')) {
                    return
                }
                warn(warning)
            }
        }
    }
})