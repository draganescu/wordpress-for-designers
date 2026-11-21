/**
 * Spike (d). The board's own entry, plus the stub of spec/agent/surface.md:
 * `window.wfdAgent.ready()` asks for the chunk the first time it is called.
 */
import '../../../../src/shell/index.js';

let surface;
window.wfdAgent = {
    ready() {
        surface ??= import(
            /* webpackChunkName: "agent" */ './agent-chunk.js'
        ).then( ( module ) => module.default );
        return surface;
    },
};
