import fs from 'fs';
import path from 'path';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';

/**
 * Writes what the tests measured to the results file, one JSON line per
 * measurement (name, value, unit): the file PERF_RESULTS names, or
 * artifacts/perf/results.jsonl. Each run writes the file afresh. Only a test
 * that passed counts, so a failed attempt leaves nothing in it.
 */
export default class ResultsReporter implements Reporter {
    private lines: string[] = [];

    onTestEnd( test: TestCase, result: TestResult ) {
        if ( result.status !== 'passed' ) {
            return;
        }
        for ( const { name, body } of result.attachments ) {
            if ( name === 'results' && body ) {
                for ( const measurement of JSON.parse( body.toString() ) ) {
                    this.lines.push( JSON.stringify( measurement ) + '\n' );
                }
            }
        }
    }

    onEnd() {
        const file =
            process.env.PERF_RESULTS ??
            path.join( process.cwd(), 'artifacts', 'perf', 'results.jsonl' );
        fs.mkdirSync( path.dirname( file ), { recursive: true } );
        fs.writeFileSync( file, this.lines.join( '' ) );
    }
}
