import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import type { FullConfig } from '@playwright/test';
import e2eSetup from '../e2e/global-setup';

/**
 * Logs in as the acceptance suite does, then starts the results file: empty,
 * with the sizes of the build in it. With PERF_APPEND set the file is left
 * as it is, so that several runs add up to one set of results.
 *
 * @param config The Playwright configuration.
 */
export default async function globalSetup( config: FullConfig ) {
    await e2eSetup( config );
    if ( process.env.PERF_APPEND ) {
        return;
    }
    const results =
        process.env.PERF_RESULTS ??
        path.join( process.cwd(), 'artifacts', 'perf', 'results.jsonl' );
    fs.mkdirSync( path.dirname( results ), { recursive: true } );
    fs.writeFileSync(
        results,
        execFileSync( process.execPath, [
            path.join( process.cwd(), 'tools', 'perf-bundle.mjs' ),
        ] )
    );
}
