#!/bin/sh
# Runs the adapter's acceptance tests (spec/acceptance.md) on a site of their
# own, on port 8889: the main plugin's test environment with the adapter added
# as a second plugin. Run `npm run build` in the repository's root first.
#
# The tests wipe that site. Arguments are passed on to Playwright.
# Stop the site afterwards with: ( cd adapters/studio && ../../node_modules/.bin/wp-env stop )
set -eu

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"

( cd "$HERE" && "$ROOT/node_modules/.bin/wp-env" start )
cd "$ROOT"
WP_BASE_URL="${WP_BASE_URL:-http://localhost:8889}" \
    node_modules/.bin/wp-scripts test-playwright --config adapters/studio/tests/playwright.config.ts "$@"
