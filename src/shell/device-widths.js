/**
 * Render widths of the three devices (spec/data-model.md, Devices).
 */
import { useMemo } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import {
    getCurrentGlobalStylesId,
    getCurrentThemeBaseGlobalStyles,
} from '../adapter/experimental';

const DEFAULT_TABLET_BREAKPOINT = 782;
const DEFAULT_MOBILE_BREAKPOINT = 480;

/**
 * @param {Object} viewport The merged `settings.viewport`, if any.
 * @return {Object} Widths in px keyed by device.
 */
export function widthsFor( viewport = {} ) {
    const tablet = parseInt( viewport.tablet, 10 ) || DEFAULT_TABLET_BREAKPOINT;
    const mobile = parseInt( viewport.mobile, 10 ) || DEFAULT_MOBILE_BREAKPOINT;
    return {
        desktop: 1440,
        tablet: tablet === DEFAULT_TABLET_BREAKPOINT ? 780 : tablet - 2,
        mobile: Math.min( 360, mobile ),
    };
}

export function useDeviceWidths() {
    const viewport = useSelect( ( select ) => {
        const base = getCurrentThemeBaseGlobalStyles( select );
        const id = getCurrentGlobalStylesId( select );
        const user = id
            ? select( coreStore ).getEditedEntityRecord(
                  'root',
                  'globalStyles',
                  id
              )
            : null;
        return {
            ...base?.settings?.viewport,
            ...user?.settings?.viewport,
        };
    }, [] );
    const { tablet, mobile } = viewport;
    return useMemo( () => widthsFor( { tablet, mobile } ), [ tablet, mobile ] );
}
