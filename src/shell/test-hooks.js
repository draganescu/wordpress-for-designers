/**
 * Counters exposed in test builds (spec/acceptance.md: AC-PERF-01,
 * AC-STYLE-03, AC-INDEX-04). They do nothing in a normal build.
 */
const isTestBuild = !! window.wfdConfig?.isTestBuild;

export const counters = {
    renders: 0,
    styleGenerations: 0,
    parses: 0,
    parsedEntities: [],
    storeCallbacks: 0,
    mountOrder: [],
    droppedWrites: {},
};

if ( isTestBuild ) {
    window.wfdTest = { counters };
}

/**
 * Counts a React render of a component. Call at the top of a component.
 */
export function countRender() {
    if ( isTestBuild ) {
        counters.renders++;
    }
}

/**
 * Exposes a value to the tests.
 *
 * @param {string} name  The name on `window.wfdTest`.
 * @param {*}      value The value.
 */
export function expose( name, value ) {
    if ( isTestBuild ) {
        window.wfdTest[ name ] = value;
    }
}
