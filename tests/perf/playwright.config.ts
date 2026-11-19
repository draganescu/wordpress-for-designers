import path from 'path';
import { defineConfig, devices } from '@playwright/test';

process.env.WP_BASE_URL ??= 'http://localhost:8888';
process.env.WP_ARTIFACTS_PATH ??= path.join( process.cwd(), 'artifacts' );

const base = require( '@wordpress/scripts/config/playwright.config.js' );

const desktop = {
    ...devices[ 'Desktop Chrome' ],
    viewport: { width: 1440, height: 900 },
};

// The performance suite. It measures and records; it is not part of the
// acceptance suite in tests/e2e. See docs/performance.md.
export default defineConfig( {
    ...base,
    testDir: '.',
    testMatch: '*.spec.ts',
    globalSetup: require.resolve( './global-setup.ts' ),
    // A retried test would record its numbers twice.
    retries: 0,
    timeout: 300_000,
    use: {
        ...base.use,
        viewport: { width: 1440, height: 900 },
        trace: 'off',
        video: 'off',
    },
    projects: [
        {
            name: 'chromium',
            use: desktop,
        },
        {
            // A high-density screen: four times the pixels to draw.
            name: 'chromium-2x',
            testMatch: 'gestures.spec.ts',
            use: { ...desktop, deviceScaleFactor: 2 },
        },
    ],
} );
