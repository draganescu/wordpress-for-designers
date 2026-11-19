/**
 * Finds the template a page is shown in: the one the page names, or else the
 * one WordPress's template hierarchy gives it.
 */
import apiFetch from '@wordpress/api-fetch';
import { addQueryArgs } from '@wordpress/url';
import { useEffect, useState } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';

const cache = new Map();
const TEMPLATE_QUERY = { per_page: -1 };

/**
 * @param {Object} page The page record.
 * @return {string|null|undefined} The template's id, null when there is none,
 *                                 undefined while it is being looked up.
 */
export function usePageTemplateId( page ) {
    const custom = page?.template;
    const slug = page?.slug;
    // A template the page names is one of the site's templates, by slug.
    const named = useSelect(
        ( select ) => {
            if ( ! custom ) {
                return null;
            }
            const templates = select( coreStore ).getEntityRecords(
                'postType',
                'wp_template',
                TEMPLATE_QUERY
            );
            if ( ! templates ) {
                return undefined;
            }
            return (
                templates.find( ( template ) => template.slug === custom )
                    ?.id ?? null
            );
        },
        [ custom ]
    );
    // Otherwise, or when that template is gone, the hierarchy decides.
    const key = page ? String( slug || page.id ) : null;
    const [ , update ] = useState( 0 );
    useEffect( () => {
        if ( ! key || cache.has( key ) ) {
            return;
        }
        let isCurrent = true;
        apiFetch( {
            path: addQueryArgs( '/wp/v2/templates/lookup', {
                slug: slug ? `page-${ slug }` : 'page',
                template_prefix: 'page',
            } ),
        } )
            .then( ( template ) => cache.set( key, template?.id ?? null ) )
            .catch( () => cache.set( key, null ) )
            .finally( () => isCurrent && update( ( n ) => n + 1 ) );
        return () => {
            isCurrent = false;
        };
    }, [ key, slug ] );
    if ( ! key ) {
        return undefined;
    }
    if ( custom ) {
        if ( named === undefined ) {
            return undefined;
        }
        if ( named ) {
            return named;
        }
    }
    return cache.get( key );
}
