/**
 * Counts and locates uses of tokens per entity, from parsed block markup and
 * the merged global styles. Never from rendered artboards (constraint C16).
 */
import { useMemo, useRef } from '@wordpress/element';
import { parse } from '@wordpress/blocks';
import { KINDS } from '../shell/constants';
import { counters } from '../shell/test-hooks';

const VAR_IN_STYLE = /var:preset\|(color|spacing)\|([a-z0-9-]+)/g;
const VAR_IN_GLOBAL =
    /var:preset\|(color|font-size|font-family|spacing)\|([a-z0-9-]+)|var\(\s*--wp--preset--(color|font-size|font-family|spacing)--([a-z0-9-]+)\s*\)/g;

const keyOf = ( type, slug ) => `${ type }:${ slug }`;

function strings( value, visit ) {
    if ( typeof value === 'string' ) {
        visit( value );
    } else if ( value && typeof value === 'object' ) {
        Object.values( value ).forEach( ( item ) => strings( item, visit ) );
    }
}

/**
 * The preset tokens one block references.
 *
 * @param {Object} block A parsed block.
 * @return {Set} Token keys, as "type:slug".
 */
export function tokensOfBlock( block ) {
    const tokens = new Set();
    const attributes = block.attributes ?? {};
    for ( const attribute of [ 'backgroundColor', 'textColor', 'gradient' ] ) {
        if ( attributes[ attribute ] ) {
            tokens.add( keyOf( 'color', attributes[ attribute ] ) );
        }
    }
    if ( attributes.fontSize ) {
        tokens.add( keyOf( 'font-size', attributes.fontSize ) );
    }
    if ( attributes.fontFamily ) {
        tokens.add( keyOf( 'font-family', attributes.fontFamily ) );
    }
    const collect = ( source, allowed ) =>
        strings( source, ( text ) => {
            for ( const match of text.matchAll( VAR_IN_STYLE ) ) {
                if ( allowed.includes( match[ 1 ] ) ) {
                    tokens.add( keyOf( match[ 1 ], match[ 2 ] ) );
                }
            }
        } );
    collect( attributes.style, [ 'color' ] );
    collect( attributes.style?.spacing, [ 'spacing' ] );
    return tokens;
}

/**
 * Indexes a block tree: for each token, the number of blocks referencing it.
 *
 * @param {Array} blocks Parsed blocks.
 * @return {Map} Token key to number of referencing blocks.
 */
export function indexBlocks( blocks ) {
    const uses = new Map();
    const walk = ( list ) => {
        for ( const block of list ?? [] ) {
            for ( const token of tokensOfBlock( block ) ) {
                uses.set( token, ( uses.get( token ) ?? 0 ) + 1 );
            }
            walk( block.innerBlocks );
        }
    };
    walk( blocks );
    return uses;
}

/**
 * References to tokens in the merged global styles (root, elements and
 * per-block entries).
 *
 * @param {Object} styles The merged `styles`.
 * @return {Map} Token key to number of references.
 */
export function indexGlobalStyles( styles ) {
    const uses = new Map();
    strings( styles, ( text ) => {
        for ( const match of text.matchAll( VAR_IN_GLOBAL ) ) {
            const token = keyOf(
                match[ 1 ] ?? match[ 3 ],
                match[ 2 ] ?? match[ 4 ]
            );
            uses.set( token, ( uses.get( token ) ?? 0 ) + 1 );
        }
    } );
    return uses;
}

function blocksOf( record ) {
    if ( Array.isArray( record.blocks ) ) {
        return record.blocks;
    }
    const content = record.content;
    if ( typeof content === 'function' ) {
        return parse( content( record ) );
    }
    return parse(
        typeof content === 'string' ? content : ( content?.raw ?? '' )
    );
}

/**
 * The brand stroke colour as a plain value. Artboard documents do not have
 * the design system's custom properties, so the outline needs the value.
 *
 * @return {string} A CSS colour.
 */
export function brandColor() {
    const probe = document.createElement( 'span' );
    probe.className = 'wfd-brand-probe';
    document.body.appendChild( probe );
    const color = window.getComputedStyle( probe ).color;
    probe.remove();
    return color;
}

/**
 * CSS that outlines the blocks referencing a token.
 *
 * @param {string} type  The token type.
 * @param {string} slug  The token slug.
 * @param {string} brand The brand stroke colour.
 * @return {string} A stylesheet, or an empty string.
 */
export function highlightCss( type, slug, brand ) {
    let selectors = [];
    if ( type === 'color' ) {
        selectors = [
            `.has-${ slug }-color`,
            `.has-${ slug }-background-color`,
            `.has-${ slug }-gradient-background`,
            `[style*="--wp--preset--color--${ slug })"]`,
        ];
    } else if ( type === 'font-size' ) {
        selectors = [ `.has-${ slug }-font-size` ];
    } else if ( type === 'font-family' ) {
        selectors = [ `.has-${ slug }-font-family` ];
    }
    if ( ! selectors.length ) {
        return '';
    }
    return `:is(${ selectors.join(
        ','
    ) }){outline:2px solid ${ brand } !important;outline-offset:2px !important;}`;
}

/**
 * @param {Array}  artboards Artboards with their edited records.
 * @param {Object} merged    The merged global styles.
 * @return {Object} `usesOf( type, slug )` and `locate( type, slug )`.
 */
export function useUsageIndex( artboards, merged ) {
    const cache = useRef( new Map() );

    // The index of an entity is rebuilt when that entity's edited record
    // changes, and at no other time.
    const entities = useMemo( () => {
        const next = new Map();
        for ( const artboard of artboards ) {
            const key = `${ artboard.kind }:${ artboard.entityId }`;
            if (
                next.has( key ) ||
                ! artboard.record ||
                KINDS[ artboard.kind ].edit !== 'editor'
            ) {
                continue;
            }
            const source = artboard.record.blocks ?? artboard.record.content;
            const cached = cache.current.get( key );
            if ( cached && cached.source === source ) {
                next.set( key, cached );
                continue;
            }
            counters.parses++;
            counters.parsedEntities.push( key );
            next.set( key, {
                source,
                uses: indexBlocks( blocksOf( artboard.record ) ),
            } );
        }
        // Nothing rebuilt and nothing dropped: the index is unchanged.
        const previous = cache.current;
        if (
            previous.size === next.size &&
            [ ...next ].every(
                ( [ key, value ] ) => previous.get( key ) === value
            )
        ) {
            return previous;
        }
        cache.current = next;
        return next;
    }, [ artboards ] );

    const globalUses = useMemo(
        () => indexGlobalStyles( merged?.styles ),
        [ merged ]
    );

    return useMemo( () => {
        const inEntity = ( key, token ) =>
            entities.get( key )?.uses.get( token ) ?? 0;
        return {
            // Changes when, and only when, an entity's index is rebuilt.
            entities,
            /**
             * A token's use count: referencing blocks across the board's
             * entities, each entity counted once, plus global styles.
             *
             * @param {string} type The token type.
             * @param {string} slug The token slug.
             * @return {number} The count.
             */
            usesOf( type, slug ) {
                const token = keyOf( type, slug );
                let total = globalUses.get( token ) ?? 0;
                for ( const key of entities.keys() ) {
                    total += inEntity( key, token );
                }
                return total;
            },
            /**
             * Where a token is used on the board.
             *
             * @param {string} type The token type.
             * @param {string} slug The token slug.
             * @return {Object} `places`, `artboards` and `perArtboard`.
             */
            locate( type, slug ) {
                const token = keyOf( type, slug );
                const perArtboard = new Map();
                let places = 0;
                for ( const key of entities.keys() ) {
                    places += inEntity( key, token );
                }
                for ( const artboard of artboards ) {
                    const count = inEntity(
                        `${ artboard.kind }:${ artboard.entityId }`,
                        token
                    );
                    if ( count ) {
                        perArtboard.set( artboard.id, count );
                    }
                }
                return { places, artboards: perArtboard.size, perArtboard };
            },
        };
    }, [ entities, globalUses, artboards ] );
}
