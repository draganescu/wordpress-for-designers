/**
 * What the right panel says about an artboard's entity (E5, E7).
 */
import { useSelect } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { serverSettings } from './editor-settings';

const TEMPLATE_QUERY = { per_page: -1 };

function contentOf( record ) {
    const content = record?.content;
    return typeof content === 'string' ? content : ( content?.raw ?? '' );
}

/**
 * Number of templates whose markup references a part or a synced pattern.
 *
 * @param {Array}  templates Template records.
 * @param {Object} artboard  The artboard with its record.
 * @return {number} The count.
 */
export function countTemplatesUsing( templates, artboard ) {
    let pattern;
    if ( artboard.kind === 'template-part' ) {
        const slug = artboard.record?.slug;
        if ( ! slug ) {
            return 0;
        }
        pattern = new RegExp(
            `<!-- wp:template-part \\{[^}]*"slug":"${ slug }"`
        );
    } else {
        pattern = new RegExp(
            `<!-- wp:block \\{[^}]*"ref":${ artboard.entityId }[,}]`
        );
    }
    return templates.filter( ( template ) =>
        pattern.test( contentOf( template ) )
    ).length;
}

/**
 * @param {Object|undefined} artboard The artboard with its record.
 * @return {Object} `description`, `usedBy` and `isArchive`.
 */
export function useEntityInfo( artboard ) {
    return useSelect(
        ( select ) => {
            if ( ! artboard ) {
                return {};
            }
            if ( artboard.kind === 'page' ) {
                return {};
            }
            if ( artboard.kind === 'media' ) {
                return {
                    width: artboard.record?.media_details?.width,
                    height: artboard.record?.media_details?.height,
                };
            }
            if ( artboard.kind === 'template' ) {
                const record = artboard.record;
                const slug = record?.slug ?? artboard.draft?.slug;
                // A new template takes the template type's own description.
                const types = serverSettings.defaultTemplateTypes ?? {};
                const type = Array.isArray( types )
                    ? types.find( ( item ) => item.slug === slug )
                    : types[ slug ];
                return {
                    description:
                        record?.description?.raw ||
                        ( typeof record?.description === 'string'
                            ? record.description
                            : '' ) ||
                        type?.description ||
                        '',
                    isArchive: slug === 'archive',
                };
            }
            const templates =
                select( coreStore ).getEntityRecords(
                    'postType',
                    'wp_template',
                    TEMPLATE_QUERY
                ) ?? [];
            return { usedBy: countTemplatesUsing( templates, artboard ) };
        },
        [ artboard ]
    );
}
