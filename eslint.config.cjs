/**
 * ESLint configuration. Adds the checks named in spec/constraints.md:
 * C1 (import allowlist), C2 (no private API outside the adapter),
 * C3 (no experimental identifiers outside the adapter) and C23 (text domain).
 */
const base = require( '@wordpress/scripts/config/eslint.config.cjs' );
const { restrictedImports } = require( './tools/allowlist.cjs' );

const PRIVATE = [
    {
        selector: "CallExpression[callee.name='unlock']",
        message: 'unlock() is allowed only in src/adapter/private.js (C2).',
    },
    {
        selector: "Identifier[name='privateApis']",
        message: 'privateApis is allowed only in src/adapter/private.js (C2).',
    },
    {
        selector: "Literal[value='core/editor']",
        message: 'The core/editor store is not allowed (D31).',
    },
];
const EXPERIMENTAL = [
    {
        selector: 'Identifier[name=/^(__experimental|__unstable)/]',
        message:
            'Experimental exports are allowed only in src/adapter/experimental.js (C3).',
    },
    {
        selector: 'JSXIdentifier[name=/^(__experimental|__unstable)/]',
        message:
            'Experimental exports are allowed only in src/adapter/experimental.js (C3).',
    },
    {
        selector: 'Literal[value=/^(__experimental|__unstable)/]',
        message:
            'Experimental exports are allowed only in src/adapter/experimental.js (C3).',
    },
];

module.exports = [
    { ignores: [ 'spikes/**', 'spec/**', 'artifacts/**' ] },
    ...base,
    {
        files: [ 'src/**/*.{js,jsx}' ],
        rules: {
            'no-restricted-imports': [ 'error', restrictedImports( false ) ],
            'no-restricted-syntax': [ 'error', ...PRIVATE, ...EXPERIMENTAL ],
            '@wordpress/i18n-text-domain': [
                'error',
                { allowedTextDomain: 'wordpress-for-designers' },
            ],
            'import/no-extraneous-dependencies': 'off',
            // WordPress packages are provided by WordPress at run time.
            'import/no-unresolved': [ 'error', { ignore: [ '^@wordpress/' ] } ],
            // The board is a keyboard-operable application region (C24).
            'jsx-a11y/no-noninteractive-tabindex': [
                'error',
                { roles: [ 'application' ], tags: [] },
            ],
        },
    },
    {
        files: [ 'src/adapter/experimental.js' ],
        rules: {
            'no-restricted-imports': [ 'error', restrictedImports( true ) ],
            'no-restricted-syntax': [ 'error', ...PRIVATE ],
        },
    },
    {
        files: [ 'src/adapter/private.js' ],
        rules: {
            'no-restricted-syntax': [ 'error', ...EXPERIMENTAL ],
        },
    },
    {
        files: [ 'tests/**/*.{js,ts}', '*.cjs', '*.js', 'tools/**' ],
        rules: {
            'import/no-extraneous-dependencies': 'off',
        },
    },
    {
        // Command-line tools print their results.
        files: [ 'tools/**' ],
        rules: { 'no-console': 'off' },
    },
];
