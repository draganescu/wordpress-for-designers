/**
 * The lists the inserter shows, read from the blocks and core-data stores.
 * Loaded once and filtered locally by the panel.
 */
import { useMemo } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { getBlockTypes, getCategories } from '@wordpress/blocks';
import { store as boardStore } from '../board-store';
import { KINDS } from '../shell/constants';
import { recordName } from '../shell/use-artboards';

const ALL = { per_page: -1 };
const USER_PATTERNS = { per_page: -1, status: 'publish,draft' };
// Every page that is not in the trash, by title. Only what a row shows is
// asked for; an artboard requests its page in full.
const PAGES = {
    per_page: -1,
    status: 'publish,future,draft,pending,private',
    orderby: 'title',
    order: 'asc',
    _fields: 'id,title,slug,status',
};
export const MEDIA_QUERY = {
    media_type: 'image',
    per_page: 50,
    orderby: 'date',
    order: 'desc',
};

function contentOf( record ) {
    const content = record?.content;
    return typeof content === 'string' ? content : ( content?.raw ?? '' );
}

/**
 * Names of the templates and parts whose markup contains a string.
 *
 * @param {Array}  records Template and template part records.
 * @param {string} needle  What to look for.
 * @return {Array} Names.
 */
function namesContaining( records, needle ) {
    return records
        .filter( ( record ) => contentOf( record ).includes( needle ) )
        .map( ( record ) => recordName( record ) );
}

/**
 * @param {string|null} allowedBlocks Comma-separated names of the blocks the
 *                                    Live editor allows at its insertion
 *                                    point; null with no artboard in edit.
 * @return {Object} Lists for InserterPanel, and `patternById` for inserting.
 */
export function useInserterData( allowedBlocks ) {
    const data = useSelect( ( select ) => {
        const core = select( coreStore );
        return {
            pages: core.getEntityRecords( 'postType', 'page', PAGES ),
            // Names not saved yet (D62) show here as everywhere else. Kept
            // as a string so that it compares equal while nothing changes.
            titleEdits: JSON.stringify(
                select( boardStore )
                    .getArtboards()
                    .filter( ( artboard ) => KINDS[ artboard.kind ].isNamed )
                    .map( ( artboard ) => [
                        `${ artboard.kind }:${ artboard.entityId }`,
                        core.getEntityRecordEdits(
                            'postType',
                            KINDS[ artboard.kind ].postType,
                            artboard.entityId
                        )?.title,
                    ] )
                    .filter( ( [ , title ] ) => typeof title === 'string' )
            ),
            templates: core.getEntityRecords( 'postType', 'wp_template', ALL ),
            parts: core.getEntityRecords( 'postType', 'wp_template_part', ALL ),
            userPatterns: core.getEntityRecords(
                'postType',
                'wp_block',
                USER_PATTERNS
            ),
            registered: core.getBlockPatterns(),
            images: core.getEntityRecords(
                'postType',
                'attachment',
                MEDIA_QUERY
            ),
            theme: core.getCurrentTheme(),
            artboards: select( boardStore ).getArtboards(),
        };
    }, [] );

    const blocks = useMemo( () => {
        const allowed =
            allowedBlocks === null
                ? null
                : new Set( allowedBlocks.split( ',' ) );
        const types = getBlockTypes().filter(
            ( type ) =>
                type.supports?.inserter !== false &&
                ! type.parent &&
                ( ! allowed || allowed.has( type.name ) )
        );
        return getCategories()
            .map( ( category ) => ( {
                category: { slug: category.slug, title: category.title },
                items: types
                    .filter( ( type ) => type.category === category.slug )
                    .map( ( type ) => ( {
                        name: type.name,
                        title: type.title,
                        icon: type.icon,
                    } ) ),
            } ) )
            .filter( ( group ) => group.items.length );
    }, [ allowedBlocks ] );

    return useMemo( () => {
        const templates = data.templates ?? [];
        const parts = data.parts ?? [];
        const containers = [ ...templates, ...parts ];
        const onBoard = ( kind, id ) =>
            data.artboards.some(
                ( artboard ) =>
                    artboard.kind === kind &&
                    String( artboard.entityId ) === String( id )
            );

        const titleEdits = new Map( JSON.parse( data.titleEdits ) );
        const nameOf = ( kind, record ) =>
            titleEdits.get( `${ kind }:${ record.id }` ) ??
            recordName( record );

        const user = ( data.userPatterns ?? [] ).map( ( pattern ) => ( {
            id: `user:${ pattern.id }`,
            name: nameOf( 'pattern', pattern ),
            isOnBoard: onBoard( 'pattern', pattern.id ),
            usedIn: namesContaining( containers, `"ref":${ pattern.id }` ),
            record: pattern,
        } ) );
        const themed = ( data.registered ?? [] )
            .filter(
                ( pattern ) =>
                    // WordPress gives the active theme's own patterns no
                    // source; core, plugin and directory patterns have one.
                    ( ! pattern.source || pattern.source === 'theme' ) &&
                    pattern.inserter !== false
            )
            .map( ( pattern ) => ( {
                id: `theme:${ pattern.name }`,
                name: pattern.title,
                isOnBoard: false,
                usedIn: namesContaining(
                    containers,
                    `"slug":"${ pattern.name }"`
                ),
                pattern,
            } ) );
        const patterns = [];
        if ( user.length ) {
            patterns.push( { source: 'user', items: user } );
        }
        if ( themed.length ) {
            patterns.push( {
                source: 'theme',
                themeName: data.theme?.name?.rendered ?? data.theme?.name ?? '',
                items: themed,
            } );
        }

        return {
            blocks,
            pages: ( data.pages ?? [] ).map( ( page ) => ( {
                id: page.id,
                name: nameOf( 'page', page ),
                isOnBoard: onBoard( 'page', page.id ),
            } ) ),
            patterns,
            templates: templates.map( ( template ) => ( {
                id: template.id,
                name: recordName( template ),
                isOnBoard: onBoard( 'template', template.id ),
            } ) ),
            templateParts: parts.map( ( part ) => ( {
                id: part.id,
                name: recordName( part ),
                isOnBoard: onBoard( 'template-part', part.id ),
            } ) ),
            media: ( data.images ?? [] ).map( ( image ) => ( {
                id: image.id,
                filename:
                    image.media_details?.file?.split( '/' ).pop() ||
                    image.source_url?.split( '/' ).pop() ||
                    recordName( image ),
                width: image.media_details?.width,
                height: image.media_details?.height,
            } ) ),
            lookup: {
                patterns: new Map(
                    [ ...user, ...themed ].map( ( item ) => [ item.id, item ] )
                ),
                parts: new Map( parts.map( ( part ) => [ part.id, part ] ) ),
                images: new Map(
                    ( data.images ?? [] ).map( ( image ) => [
                        image.id,
                        image,
                    ] )
                ),
            },
        };
    }, [ data, blocks ] );
}
