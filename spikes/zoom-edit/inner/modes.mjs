// Runtime-injected emulations of "canvas zoom z" for the Live artboard.
// Nothing here touches the app source: one <style id="zs"> in the parent
// document and, for the C candidates, one <style id="zs-inner"> in the canvas.
const LIVE = '[data-wfd-artboard][data-wfd-tier="live"]';
const W = 1440;

const wrappers = ( w, h ) => `
[data-wfd-artboard]:not([data-wfd-tier="live"]){visibility:hidden!important;pointer-events:none!important}
${ LIVE }{width:${ w }px!important;height:${ h }px!important;left:0!important;top:0!important}
${ LIVE } .wfd-artboard__frame{width:${ w }px!important;height:${ h }px!important}
${ LIVE } .wfd-artboard__frame > div{width:${ w }px!important;height:${ h }px!important}
${ LIVE } .block-editor-iframe__container,${ LIVE } .block-editor-iframe__scale-container{width:${ w }px!important;height:${ h }px!important;margin:0!important}
`;

export const MODES = {
    // Control / earlier spike: the whole surface scaled, tools included.
    naive: ( z, t ) => ( {
        css: `.wfd-canvas__surface{transform:translate(${ t.x }px,${ t.y }px) scale(${ z })!important;--wfd-zoom:${ z }!important}
[data-wfd-artboard]:not([data-wfd-tier="live"]){visibility:hidden!important;pointer-events:none!important}
${ LIVE }{left:0!important;top:0!important}`,
    } ),
    // (A1) CSS zoom on the surface instead of scale.
    'A-surface-zoom': ( z, t ) => ( {
        css: `.wfd-canvas__surface{transform:translate(${ t.x }px,${ t.y }px)!important;zoom:${ z }!important}
[data-wfd-artboard]:not([data-wfd-tier="live"]){visibility:hidden!important;pointer-events:none!important}
${ LIVE }{left:0!important;top:0!important}`,
    } ),
    // (A2) CSS zoom on the Live artboard element (it carries width:1440px; tools inside the zoomed box),
    // no scale on the surface.
    'A-artboard-zoom': ( z, t ) => ( {
        css: `.wfd-canvas__surface{transform:translate(${ t.x }px,${ t.y }px)!important}
[data-wfd-artboard]:not([data-wfd-tier="live"]){visibility:hidden!important;pointer-events:none!important}
${ LIVE }{left:0!important;top:0!important;zoom:${ z }!important}`,
    } ),
    // (A3) CSS zoom on the iframe element only (tools outside the zoom).
    'A-iframe-zoom': ( z, t, h ) => ( {
        css: `.wfd-canvas__surface{transform:translate(${ t.x }px,${ t.y }px)!important}
${ wrappers( W * z, h * z ) }
${ LIVE } iframe[name="editor-canvas"]{zoom:${ z }!important;width:${ W }px!important;height:${ h }px!important;max-width:none!important}`,
    } ),
    // (A4) CSS zoom on html inside the canvas document, iframe at on-screen size.
    'A-html-zoom': ( z, t, h ) => ( {
        css: `.wfd-canvas__surface{transform:translate(${ t.x }px,${ t.y }px)!important}
${ wrappers( W * z, h * z ) }
${ LIVE } iframe[name="editor-canvas"]{width:${ W * z }px!important;height:${ h * z }px!important;max-width:none!important}`,
        inner: `html{zoom:${ z }}`,
    } ),
    // (B) no scale on any ancestor; iframe element transform only.
    B: ( z, t, h ) => ( {
        css: `.wfd-canvas__surface{transform:translate(${ t.x }px,${ t.y }px)!important}
${ wrappers( W * z, h * z ) }
${ LIVE } iframe[name="editor-canvas"]{width:${ W }px!important;height:${ h }px!important;max-width:none!important;transform:scale(${ z })!important;transform-origin:0 0!important}`,
    } ),
    // (C) scale inside the canvas document, iframe at on-screen size.
    'C-html-transform': ( z, t, h ) => ( {
        css: `.wfd-canvas__surface{transform:translate(${ t.x }px,${ t.y }px)!important}
${ wrappers( W * z, h * z ) }
${ LIVE } iframe[name="editor-canvas"]{width:${ W * z }px!important;height:${ h * z }px!important;max-width:none!important}`,
        inner: `html{transform:scale(${ z });transform-origin:0 0;width:${ W }px;}`,
    } ),
};

// Optional add-on: make BlockPopoverCover containers match the scaled block
// from outside (parent-document CSS only), keeping their children full size.
export const coverFix = ( z ) => `
.block-editor-block-popover > .components-popover__content > div[style*="position: absolute"]{transform:scale(${ z });transform-origin:0 0;}
.block-editor-block-list__empty-block-inserter{transform:scale(${ 1 / z });transform-origin:100% 0;}
`;

export async function applyMode( page, mode, z, t, h, { fix = false } = {} ) {
    const { css, inner } = MODES[ mode ]( z, t, h );
    await page.evaluate(
        ( [ css, inner ] ) => {
            let s = document.getElementById( 'zs' );
            if ( ! s ) {
                s = document.createElement( 'style' );
                s.id = 'zs';
                document.head.appendChild( s );
            }
            s.textContent = css;
            const doc = document.querySelector( 'iframe[name="editor-canvas"]' ).contentDocument;
            let i = doc.getElementById( 'zs-inner' );
            if ( inner ) {
                if ( ! i ) {
                    i = doc.createElement( 'style' );
                    i.id = 'zs-inner';
                    doc.head.appendChild( i );
                }
                i.textContent = inner;
            } else if ( i ) {
                i.remove();
            }
        },
        [ css + ( fix && z !== 1 ? coverFix( z ) : '' ), inner ]
    );
    await page.waitForTimeout( 250 );
}
