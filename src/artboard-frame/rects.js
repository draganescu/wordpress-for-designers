/**
 * The Element rectangles seam of the agent surface (spec/agent/surface.md,
 * Seams): an artboard's frame element and the document it currently draws.
 * Read by `src/agent/` alone.
 */

/**
 * @param {string} id The artboard.
 * @return {Object} `frame`, the frame element or null, and `document`, the
 *                  document of what the frame draws or null when nothing of
 *                  it is mounted.
 */
export function frameOf( id ) {
    const frame = document.querySelector(
        `[data-wfd-artboard="${ id }"] .wfd-artboard__frame`
    );
    // The Live or warm editor's canvas, a frozen copy, or a Preview. A
    // frozen copy lies over the render that will replace it (D51).
    const iframe =
        frame?.querySelector( 'iframe[name="editor-canvas"]' ) ??
        frame?.querySelector( '.wfd-snapshot iframe' ) ??
        frame?.querySelector( '.wfd-preview iframe' ) ??
        null;
    return {
        frame: frame ?? null,
        iframe,
        document: iframe?.contentDocument?.body ? iframe.contentDocument : null,
    };
}
