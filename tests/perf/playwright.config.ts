import { defineConfig } from '@playwright/test';
import e2e from '../e2e/playwright.config';

const [ chromium ] = e2e.projects!;

// The performance suite. It measures and records; it is not part of the
// acceptance suite in tests/e2e, whose site, login and browser it shares.
// See docs/performance.md.
export default defineConfig( {
    ...e2e,
    testDir: __dirname,
    // A measurement that fails is looked at, not tried again.
    retries: 0,
    timeout: 300_000,
    reporter: [
        ...( e2e.reporter as [ string ][] ),
        [ require.resolve( './reporter.ts' ) ],
    ],
    use: { ...e2e.use, trace: 'off', video: 'off' },
    projects: [
        chromium,
        // A high-density screen, four times the pixels to draw. Not on CI,
        // which draws in software: "On a real laptop", docs/performance.md.
        ...( process.env.CI
            ? []
            : [
                  {
                      name: 'chromium-2x',
                      testMatch: 'gestures.spec.ts',
                      use: { ...chromium.use, deviceScaleFactor: 2 },
                  },
              ] ),
    ],
} );
