/**
 * What a browser on the board draws, and when (D55 to D57). The shell asks
 * here instead of knowing how a browser loads, reloads and previews.
 */
import { useDispatch, useSelect } from '@wordpress/data';
import { Skeleton } from '@wordpress/ui';
import { store as boardStore } from '../board-store';
import { isNearView } from '../tier-scheduler';
import { ArtboardBrowser } from './browser';

/**
 * A browser is outside the tiers: it is being browsed, or its page is loaded
 * because it is near the view, or it is a sized box.
 *
 * @param {Object} artboard         The browser.
 * @param {Object} where
 * @param {string} where.browsingId The browser being browsed, if any.
 * @param {Object} where.rect       The browser's rectangle in board units.
 * @param {Object} where.viewport   The settled viewport.
 * @param {Object} where.size       The canvas area size.
 * @return {string} 'live', 'browser' or 'ghost', for the frame.
 */
export function browserTier( artboard, { browsingId, rect, viewport, size } ) {
    if ( artboard.id === browsingId ) {
        return 'live';
    }
    return isNearView( rect, viewport, size ) ? 'browser' : 'ghost';
}

/**
 * The page of a browser that is not a box.
 *
 * @param {Object}                 props
 * @param {Object}                 props.artboard   The browser.
 * @param {boolean}                props.isBrowsing Whether it is browsed.
 * @param {string}                 props.homeUrl    The site's home URL.
 * @param {(event: Event) => void} props.onEscape   Ends browsing.
 * @param {(event: Event) => void} props.onWheel    Zooms the board.
 */
export function BrowserArtboard( {
    artboard,
    isBrowsing,
    homeUrl,
    onEscape,
    onWheel,
} ) {
    const { siteVersion, previewVersion, previewValue, reloads } = useSelect(
        ( select ) => {
            const board = select( boardStore );
            return {
                siteVersion: board.getSiteVersion(),
                previewVersion: board.getPreviewVersion(),
                previewValue: board.getPreviewValue(),
                reloads: board.getBrowserReloads( artboard.id ),
            };
        },
        [ artboard.id ]
    );
    const { updateArtboard } = useDispatch( boardStore );
    const isPreview = artboard.shows === 'unsaved';
    if ( isPreview && ! previewVersion ) {
        // Unsaved changes are shown once they have been sent (D57).
        return <Skeleton className="wfd-artboard__skeleton" />;
    }
    return (
        <ArtboardBrowser
            // Changing what it shows loads the page again from the top.
            key={ artboard.shows }
            path={ artboard.path }
            homeUrl={ homeUrl }
            isBrowsing={ isBrowsing }
            preview={ isPreview ? previewValue : null }
            // It reloads when what it shows has changed on the server, and
            // when Reload is pressed.
            reloadToken={
                ( isPreview ? previewVersion : siteVersion ) + reloads
            }
            onNavigate={ ( path ) => updateArtboard( artboard.id, { path } ) }
            onEscape={ onEscape }
            onWheel={ onWheel }
        />
    );
}
