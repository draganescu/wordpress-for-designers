// The recipe under test. `variant` selects the fix for BlockPopoverCover:
//   none      - counter structure only (reproduces the earlier spike)
//   zoom      - cover container gets CSS zoom
//   transform - cover container gets transform: scale
export function recipeCss( { z, tx = 24, ty = 44, variant = 'transform', frameVisible = true } ) {
    const LIVE = '.wfd-artboard[data-wfd-tier="live"] .wfd-artboard__frame';
    const TOOLS = `${ LIVE } > div:has(> .block-editor-iframe__container)`;
    // Not scoped to the artboard: cover popovers that name a slot BlockTools does not render
    // (e.g. "block-toolbar" when hasFixedToolbar is on) fall back to the page-level Popover.Slot.
    const COVER = `.block-editor-block-popover > .components-popover__content > div[style*="position: absolute"]`;
    let css = `
/* --- simulation only: what src/viewport would write --- */
.wfd-canvas__surface { transform: translate(${ tx }px, ${ ty }px) scale(${ z }) !important; --wfd-zoom: ${ z } !important; }

/* --- recipe --- */
/* 0. the edit zoom, readable by popovers rendered outside the surface (plugin sets it on the shell root while Live) */
:root { --wfd-edit-zoom: ${ z }; }
/* 1. tools layer (the BlockTools wrapper) back to screen scale */
${ TOOLS } { transform: scale(calc(1 / var(--wfd-zoom))); transform-origin: 0 0; pointer-events: none; }
${ TOOLS } > .block-editor-iframe__container,
${ TOOLS } > .block-editor-iframe__container > .block-editor-iframe__scale-container { pointer-events: none; }
${ TOOLS } > .popover-slot { pointer-events: auto; }
/* 2. the canvas iframe itself carries the zoom */
${ TOOLS } iframe[name="editor-canvas"] { transform: scale(var(--wfd-zoom)); transform-origin: 0 0; pointer-events: auto; }
`;
    if ( frameVisible ) {
        css += `/* 3. popovers may leave the artboard's box */
${ LIVE } { overflow: visible; }
`;
    }
    if ( variant === 'zoom' ) {
        css += `/* 4. BlockPopoverCover: container sized from offsetWidth/Height -> bring it to canvas scale */
${ COVER } { zoom: var(--wfd-edit-zoom, 1); }
${ COVER } > .block-editor-block-list__empty-block-inserter { zoom: calc(1 / var(--wfd-edit-zoom, 1)); }
`;
    }
    if ( variant === 'transform' ) {
        css += `/* 4. BlockPopoverCover: container sized from offsetWidth/Height -> bring it to canvas scale */
${ COVER } { transform: scale(var(--wfd-edit-zoom, 1)); transform-origin: 0 0; }
${ COVER } > .block-editor-block-list__empty-block-inserter { transform: scale(calc(1 / var(--wfd-edit-zoom, 1))); transform-origin: 100% 0; }
`;
    }
    return css;
}
