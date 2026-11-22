/**
 * The adapter's tests run on a site of their own: the main plugin's test
 * environment (its fixture, its test helper plugin and its test theme) with
 * the adapter and the MCP Adapter plugin added, described by
 * `../.wp-env.json`.
 *
 * From the repository's root, after `npm run build`:
 *
 *   sh adapters/abilities/test.sh
 */
import path from 'path';
import { defineConfig, devices } from '@playwright/test';

const ADAPTER = path.join( __dirname, '..' );
const ROOT = path.join( ADAPTER, '..', '..' );

process.env.WP_BASE_URL ??= 'http://localhost:8890';
process.env.WP_ARTIFACTS_PATH ??= path.join( ADAPTER, 'artifacts' );

const base = require( '@wordpress/scripts/config/playwright.config.js' );

export default defineConfig( {
    ...base,
    testDir: '.',
    testMatch: '*.spec.ts',
    globalSetup: require.resolve( '../../../tests/e2e/global-setup.ts' ),
    use: {
        ...base.use,
        viewport: { width: 1440, height: 900 },
    },
    webServer: {
        ...base.webServer,
        command: `"${ path.join( ROOT, 'node_modules/.bin/wp-env' ) }" start`,
        cwd: ADAPTER,
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
