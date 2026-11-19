/**
 * The only file allowed to import experimental exports (constraint C3).
 * Each is re-exported under a plain name.
 */
export { __experimentalListView as ListView } from '@wordpress/block-editor';
export {
    __experimentalToggleGroupControl as ToggleGroupControl,
    __experimentalToggleGroupControlOption as ToggleGroupControlOption,
    __experimentalConfirmDialog as ConfirmDialog,
    __experimentalHStack as HStack,
    __experimentalVStack as VStack,
    __experimentalItemGroup as ItemGroup,
    __experimentalItem as Item,
    __experimentalText as ComponentsText,
    __experimentalHeading as ComponentsHeading,
} from '@wordpress/components';

/*
 * Experimental core-data selectors, wrapped so callers pass the `select`
 * function they already have.
 */
import { store as coreStore } from '@wordpress/core-data';

export const getDirtyEntityRecords = ( select ) =>
    select( coreStore ).__experimentalGetDirtyEntityRecords();

export const getCurrentGlobalStylesId = ( select ) =>
    select( coreStore ).__experimentalGetCurrentGlobalStylesId();

export const getCurrentThemeBaseGlobalStyles = ( select ) =>
    select( coreStore ).__experimentalGetCurrentThemeBaseGlobalStyles();

export const getCurrentThemeGlobalStylesVariations = ( select ) =>
    select( coreStore ).__experimentalGetCurrentThemeGlobalStylesVariations();
