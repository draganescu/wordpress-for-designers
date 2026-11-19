/**
 * Viewport-height units inside an artboard.
 *
 * An artboard's iframe is as tall as its content, so `100vh` there means
 * "as tall as the content", and content sized with it grows every time the
 * iframe is fitted to it: the artboard never stops getting taller. The units
 * are resolved against a fixed viewport height instead: rewritten in the
 * style sheets the plugin passes to the canvas, and overridden by generated
 * rules where they are in inline styles or in a style sheet WordPress loads
 * into the canvas itself. Nothing in the canvas document is changed
 * (constraint C6).
 */
import { useEffect, useState } from '@wordpress/element';

/**
 * The viewport height the units are resolved against, in pixels: the height
 * of a new artboard before it is measured.
 */
export const VIEWPORT_HEIGHT = 900;

// Comments and strings are matched first so that nothing inside them is
// rewritten; a selector such as [style*="min-height:100vh"] has to stay.
const TOKEN =
    /\/\*[\s\S]*?\*\/|"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|(?<![\w#.-])(-?(?:\d+\.?\d*|\.\d+))([sld]?v(?:h|b|min|max))\b/gi;

const INLINE = '[style*="vh"],[style*="vb"],[style*="vmin"],[style*="vmax"]';
const PROPERTY = /^-{0,2}[a-z][\w-]*$/i;

/**
 * Rewrites viewport-height lengths as pixels of the fixed viewport.
 *
 * @param {string} css Style sheet text or one value.
 * @return {string} The same text with the lengths replaced.
 */
export function pinViewportUnits( css ) {
    if ( ! css || ! /v(?:h|b|min|max)\b/i.test( css ) ) {
        return css;
    }
    return css.replace( TOKEN, ( match, number, unit ) => {
        if ( number === undefined ) {
            return match;
        }
        const pixels =
            +( ( parseFloat( number ) * VIEWPORT_HEIGHT ) / 100 ).toFixed( 4 ) +
            'px';
        const kind = unit.toLowerCase().replace( /^[sld]/, '' );
        if ( kind === 'vmin' ) {
            return `min(${ number }vw, ${ pixels })`;
        }
        if ( kind === 'vmax' ) {
            return `max(${ number }vw, ${ pixels })`;
        }
        return pixels;
    } );
}

/**
 * The editor styles with their viewport-height lengths pinned.
 *
 * @param {Array} styles The `styles` editor setting.
 * @return {Array} The styles, with the same entries where nothing changed.
 */
export function pinStyles( styles ) {
    return styles?.map( ( style ) => {
        const css = pinViewportUnits( style.css );
        return css === style.css ? style : { ...style, css };
    } );
}

/**
 * Rules that override the inline styles of a document that use
 * viewport-height lengths.
 *
 * @param {Document} doc The canvas document.
 * @return {string} Style sheet text, empty when there is nothing to override.
 */
function inlineOverrides( doc ) {
    const rules = new Set();
    doc.querySelectorAll( INLINE ).forEach( ( element ) => {
        const text = element.getAttribute( 'style' ) ?? '';
        text.split( ';' ).forEach( ( declaration ) => {
            const colon = declaration.indexOf( ':' );
            const property = declaration.slice( 0, colon ).trim();
            const literal = declaration.trim();
            if (
                colon < 1 ||
                ! PROPERTY.test( property ) ||
                literal.includes( '\n' )
            ) {
                return;
            }
            const value = declaration
                .slice( colon + 1 )
                .replace( /!important\s*$/i, '' )
                .trim();
            const pinned = pinViewportUnits( value );
            if ( pinned !== value ) {
                rules.add(
                    `[style*="${ literal.replace(
                        /["\\]/g,
                        '\\$&'
                    ) }"]{${ property }:${ pinned } !important}`
                );
            }
        } );
    } );
    return [ ...rules ].sort().join( '' );
}

const UNIT = /v(?:h|b|min|max)\b/i;
const sheetCache = new WeakMap();

/**
 * Rules that repeat the declarations of a rule list that use viewport-height
 * lengths, pinned, under the same selectors and conditions.
 *
 * @param {CSSRuleList} rules Rules of a style sheet or of a grouping rule.
 * @return {string} Style sheet text.
 */
function ruleOverrides( rules ) {
    let css = '';
    for ( const rule of rules ) {
        // Part of an animation cannot be overridden on its own.
        if ( rule.cssText.startsWith( '@keyframes' ) ) {
            continue;
        }
        let body = '';
        const { style } = rule;
        if ( style && UNIT.test( style.cssText ) ) {
            for ( const property of style ) {
                const value = style.getPropertyValue( property );
                const pinned = pinViewportUnits( value );
                if ( pinned !== value ) {
                    const priority = style.getPropertyPriority( property );
                    body += `${ property }:${ pinned }${
                        priority ? ' !important' : ''
                    };`;
                }
            }
        }
        if ( rule.cssRules?.length ) {
            body += ruleOverrides( rule.cssRules );
        }
        if ( body ) {
            const prefix = rule.cssText.slice( 0, rule.cssText.indexOf( '{' ) );
            css += `${ prefix }{${ body }}`;
        }
    }
    return css;
}

/**
 * Overrides for every style sheet of a document. A sheet is read once; a
 * sheet whose text is already pinned gives nothing.
 *
 * @param {Document} doc The canvas document.
 * @return {string} Style sheet text.
 */
function sheetOverrides( doc ) {
    let css = '';
    for ( const sheet of doc.styleSheets ) {
        if ( ! sheetCache.has( sheet ) ) {
            try {
                sheetCache.set( sheet, ruleOverrides( sheet.cssRules ) );
            } catch {
                // A sheet from another origin cannot be read.
                sheetCache.set( sheet, '' );
            }
        }
        css += sheetCache.get( sheet );
    }
    return css;
}

/**
 * Watches the canvas document in an artboard's frame from outside, and
 * returns the rules that pin the viewport-height lengths the plugin could
 * not rewrite: those of inline styles and of the style sheets WordPress
 * loads into the canvas.
 *
 * @param {Element} frame The artboard's frame element.
 * @return {string} Style sheet text for the canvas.
 */
export function useViewportOverrides( frame ) {
    const [ css, setCss ] = useState( '' );
    useEffect( () => {
        if ( ! frame ) {
            return;
        }
        let watched = null;
        let detach = () => {};
        const attach = () => {
            const doc = frame.querySelector( 'iframe' )?.contentDocument;
            if ( ! doc?.body || doc === watched ) {
                return;
            }
            detach();
            watched = doc;
            const scan = () =>
                setCss( sheetOverrides( doc ) + inlineOverrides( doc ) );
            const observer = new doc.defaultView.MutationObserver( scan );
            observer.observe( doc.documentElement, {
                subtree: true,
                childList: true,
                attributes: true,
                attributeFilter: [ 'style' ],
            } );
            // A linked style sheet can be read once it has loaded.
            doc.addEventListener( 'load', scan, true );
            detach = () => {
                observer.disconnect();
                doc.removeEventListener( 'load', scan, true );
            };
            scan();
        };
        // The canvas document is filled in after the iframe loads.
        const timer = window.setInterval( attach, 100 );
        attach();
        return () => {
            window.clearInterval( timer );
            detach();
        };
    }, [ frame ] );
    return css;
}
