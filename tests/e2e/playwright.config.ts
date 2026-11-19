import path from 'path';
import { defineConfig, devices } from '@playwright/test';

process.env.WP_BASE_URL ??= 'http://localhost:8888';
process.env.WP_ARTIFACTS_PATH ??= path.join( process.cwd(), 'artifacts' );

const base = require( '@wordpress/scripts/config/playwright.config.js' );

export default defineConfig( {
    ...base,
    testDir: '.',
    testMatch: '*.spec.ts',
    globalSetup: require.resolve( './global-setup.ts' ),
    use: {
        ...base.use,
        viewport: { width: 1440, height: 900 },
    },
    projects: [
        {
            name: 'chromium',
            use: {
                ...devices[ 'Desktop Chrome' ],
                viewport: { width: 1440, height: 900 },
            },
        },
    ],
} );
