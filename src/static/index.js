/**
 * Fixed-data renderings of every screen in spec/screens/, for the Milestone 2
 * comparison against the images. Reachable only in test builds, through the
 * `wfd-screen` query argument. No behaviour.
 */
import { useLayoutEffect, useRef } from '@wordpress/element';
import { SlotFillProvider, Popover } from '@wordpress/components';
import { useEnableWpCompatOverlaySlot } from '@wordpress/ui';
import { ArtboardError, ArtboardFrame } from '../artboard-frame';
import { InserterPanel } from '../inserter/inserter-panel';
import { fixtures as inserterFixtures } from '../inserter/fixtures';
import { ReviewDrawer } from '../review/review-drawer';
import { fixtures as reviewFixtures } from '../review/fixtures';
import { StylesPanel } from '../styles/styles-panel';
import { fixtures as stylesFixtures } from '../styles/fixtures';
import { ArtboardsPanel, ListViewPanel } from '../shell/artboards-panel';
import {
    Canvas,
    EmptyBoard,
    PlacementOutline,
    PreviewBanner,
    UsageBanner,
} from '../shell/canvas';
import { DEFAULT_WIDTHS } from '../shell/constants';
import { LockDialog, RemoveDialog } from '../shell/dialogs';
import { Header } from '../shell/header';
import { artboardLabel, liveLabel } from '../shell/labels';
import { ArtboardSettings, EditingPanel } from '../shell/right-panel';
import { Shell } from '../shell/shell';
import { boundsOf, fitBounds } from '../viewport/math';

const board = ( rows ) =>
    rows.map( ( [ id, kind, name, device, x, y, height ] ) => ( {
        id,
        kind,
        name,
        device,
        x,
        y,
        height,
    } ) );

const ARTBOARDS = board( [
    [ 'front', 'template', 'Front page', 'desktop', 0, 0, 2340 ],
    [ 'single', 'template', 'Single post', 'desktop', 0, 2680, 2400 ],
    [ 'header', 'template-part', 'Header', 'desktop', 1580, 0, 480 ],
    [ 'header-m', 'template-part', 'Header', 'mobile', 1580, 800, 340 ],
    [ 'hero', 'pattern', 'Hero', 'desktop', 1580, 1480, 750 ],
    [ 'sign', 'pattern', 'Sign-off', 'desktop', 1580, 2560, 460 ],
    [ 'about', 'page', 'About', 'desktop', 3040, 800, 2220 ],
    [ 'footer', 'template-part', 'Footer', 'desktop', 1580, 3300, 480 ],
    [ 'member', 'page', 'Become a member', 'desktop', 4600, 800, 2200 ],
] );
const ARCHIVE = {
    id: 'archive',
    kind: 'template',
    name: 'Archive',
    device: 'desktop',
    x: 3040,
    y: 3300,
    height: 1120,
};
const BOARD_NAME = 'The Slow Margin, redesign';
const find = ( id ) => ARTBOARDS.find( ( artboard ) => artboard.id === id );

/**
 * What differs per screen. Keys: selected, live, left, right, inserter,
 * styles, review, dialog, banner, error, artboards, zoom.
 */
const SCREENS = {
    Overview: { styles: 'Overview' },
    Main: { live: 'header', left: 'list', right: 'block', zoom: 1 },
    Selected: { selected: 'front' },
    EmptyBoard: { artboards: [], styles: 'Overview', reviewCount: 0 },
    ErrorArtboard: { styles: 'Overview', error: 'hero' },
    AddArtboard: {
        inserter: 'AddArtboard',
        styles: 'Overview',
        placement: ARCHIVE,
    },
    AddArtboard2: {
        artboards: [ ...ARTBOARDS, ARCHIVE ],
        live: 'archive',
        left: 'list',
        right: 'entity',
        zoom: 1,
        reviewCount: 4,
    },
    DeleteDialog: { selected: 'sign', dialog: 'delete' },
    ResetDialog: { selected: 'front', dialog: 'reset' },
    LockDialog: { selected: 'about', dialog: 'lock' },
    LockDialogTaken: { selected: 'about', dialog: 'lock-taken' },
    InserterBlocks: {
        live: 'header',
        inserter: 'InserterBlocks',
        right: 'block',
        zoom: 1,
    },
    InserterEmpty: { inserter: 'InserterEmpty', styles: 'Overview' },
    InserterMedia: {
        live: 'header',
        inserter: 'InserterMedia',
        right: 'block',
        zoom: 1,
    },
    InserterPages: { inserter: 'InserterPages', styles: 'Overview' },
    InserterTemplates: { inserter: 'InserterTemplates', styles: 'Overview' },
    Library: {
        inserter: 'Library',
        styles: 'Overview',
        placement: {
            ...ARCHIVE,
            kind: 'pattern',
            name: 'Post list',
            isDrop: true,
        },
    },
    Styles: {
        styles: 'Styles',
        banner: 'usage',
        uses: { front: 1, hero: 1, about: 1 },
    },
    StylesBlocks: { styles: 'StylesBlocks' },
    StylesHistory: { styles: 'StylesHistory', banner: 'preview' },
    Review: { review: 'Review', changed: [ 'header', 'header-m', 'about' ] },
    ReviewEmpty: { review: 'ReviewEmpty', reviewCount: 0 },
    ReviewError: { review: 'ReviewError', changed: [ 'header', 'header-m' ] },
};

function useFixedViewport( artboards, zoom, focusId ) {
    const areaRef = useRef();
    const surfaceRef = useRef();
    useLayoutEffect( () => {
        const area = areaRef.current;
        const surface = surfaceRef.current;
        const size = { width: area.clientWidth, height: area.clientHeight };
        const rects = artboards.map( ( artboard ) => ( {
            x: artboard.x,
            y: artboard.y,
            width: DEFAULT_WIDTHS[ artboard.device ],
            height: artboard.height,
        } ) );
        let view = fitBounds( boundsOf( rects ), size );
        const focus = artboards.find( ( artboard ) => artboard.id === focusId );
        if ( zoom && focus ) {
            view = { zoom, x: 24 - focus.x * zoom, y: 48 - focus.y * zoom };
        }
        surface.style.transform = `translate(${ view.x }px, ${ view.y }px) scale(${ view.zoom })`;
        surface.style.setProperty( '--wfd-zoom', String( view.zoom ) );
        area.dataset.wfdZoom = String( Math.round( view.zoom * 100 ) );
    } );
    return { areaRef, surfaceRef };
}

export function StaticScreen( { name } ) {
    useEnableWpCompatOverlaySlot();
    const screen = SCREENS[ name ] || SCREENS.Overview;
    const artboards = screen.artboards || ARTBOARDS;
    const live = artboards.find( ( a ) => a.id === screen.live );
    const selected = find( screen.selected );
    const { areaRef, surfaceRef } = useFixedViewport(
        artboards,
        screen.zoom,
        screen.live
    );
    let left = (
        <ArtboardsPanel
            artboards={ artboards }
            selectedId={ screen.selected }
            onSelect={ () => {} }
            onEdit={ () => {} }
        />
    );
    if ( screen.inserter ) {
        left = <InserterPanel { ...inserterFixtures[ screen.inserter ] } />;
    } else if ( screen.left === 'list' ) {
        left = <ListViewPanel onClose={ () => {} } />;
    }

    let right = (
        <StylesPanel { ...stylesFixtures[ screen.styles || 'Overview' ] } />
    );
    if ( live ) {
        right = (
            <EditingPanel
                artboard={ live }
                info={
                    live.id === 'archive'
                        ? {
                              description:
                                  'Shows lists of posts by category, tag or date.',
                              isArchive: true,
                          }
                        : { usedBy: 3 }
                }
                tab={ screen.right === 'block' ? 'block' : 'entity' }
                blockTitle={
                    screen.right === 'block' ? 'Navigation' : undefined
                }
                scope="block"
            />
        );
    } else if ( selected ) {
        right = (
            <ArtboardSettings
                artboard={ selected }
                info={
                    selected.kind === 'template'
                        ? { description: "Shown on the site's front page." }
                        : { usedBy: 1 }
                }
            />
        );
    }

    let banner = null;
    if ( screen.banner === 'usage' ) {
        banner = (
            <UsageBanner
                usage={ {
                    name: 'Brick',
                    color: '#b4432b',
                    places: 3,
                    artboards: 3,
                } }
            />
        );
    } else if ( screen.banner === 'preview' ) {
        banner = <PreviewBanner date="17 Nov" time="16:40" />;
    }

    let dialog = null;
    if ( screen.dialog === 'delete' ) {
        dialog = <RemoveDialog artboard={ selected } />;
    } else if ( screen.dialog === 'reset' ) {
        dialog = <RemoveDialog artboard={ selected } isThemeItem />;
    } else if ( screen.dialog === 'lock' ) {
        dialog = <LockDialog state="locked" userName="Ana" />;
    } else if ( screen.dialog === 'lock-taken' ) {
        dialog = <LockDialog state="taken" userName="Ana" />;
    }

    const placement = screen.placement;
    const noop = { disabled: false, onClick: () => {} };

    return (
        <SlotFillProvider>
            <Shell
                header={
                    <Header
                        boardsUrl={ window.wfdConfig.boardsUrl }
                        boardName={ BOARD_NAME }
                        liveName={ live ? liveLabel( live ) : null }
                        isInserterOpen={ !! screen.inserter }
                        undo={ {
                            ...noop,
                            label: live
                                ? 'Undo block spacing, in Header'
                                : 'Undo move artboard, on the board',
                        } }
                        redo={ { ...noop, label: 'Redo', disabled: true } }
                        isListViewOpen={ screen.left === 'list' }
                        isListViewDisabled={ ! live }
                        zoomPercent={ screen.zoom ? screen.zoom * 100 : 17 }
                        onZoom={ () => {} }
                        canFitSelection={ !! selected }
                        reviewCount={ screen.reviewCount ?? 3 }
                    />
                }
                left={ left }
                canvas={
                    <Canvas
                        ref={ areaRef }
                        surfaceRef={ surfaceRef }
                        banner={ banner }
                        emptyState={
                            artboards.length ? null : (
                                <EmptyBoard onAdd={ () => {} } />
                            )
                        }
                        overlay={
                            placement && (
                                <PlacementOutline
                                    rect={ {
                                        x: placement.x,
                                        y: placement.y,
                                        width: DEFAULT_WIDTHS.desktop,
                                        height: placement.height,
                                    } }
                                    label={ artboardLabel( placement ) }
                                    hint={
                                        placement.isDrop
                                            ? 'Drop to open as an artboard'
                                            : 'Click to place'
                                    }
                                />
                            )
                        }
                    >
                        { artboards.map( ( artboard ) => (
                            <ArtboardFrame
                                key={ artboard.id }
                                artboard={ artboard }
                                width={ DEFAULT_WIDTHS[ artboard.device ] }
                                tier={
                                    artboard.id === screen.live
                                        ? 'live'
                                        : 'ghost'
                                }
                                isSelected={ artboard.id === screen.selected }
                                uses={ screen.uses?.[ artboard.id ] }
                                isChanged={ screen.changed?.includes(
                                    artboard.id
                                ) }
                                hasError={ screen.error === artboard.id }
                            >
                                { screen.error === artboard.id && (
                                    <ArtboardError kind={ artboard.kind } />
                                ) }
                            </ArtboardFrame>
                        ) ) }
                    </Canvas>
                }
                right={ right }
                overlays={
                    <>
                        { screen.review && (
                            <ReviewDrawer
                                { ...reviewFixtures[ screen.review ] }
                                isOpen
                            />
                        ) }
                        { dialog }
                    </>
                }
            />
            <Popover.Slot />
        </SlotFillProvider>
    );
}
