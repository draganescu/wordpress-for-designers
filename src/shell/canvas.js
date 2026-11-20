/**
 * Region: Canvas. The surface is transformed by the viewport; everything on
 * it is positioned in board units.
 */
import { countRender } from './test-hooks';
import { __, _n, sprintf } from '@wordpress/i18n';
import { forwardRef } from '@wordpress/element';
import { ColorIndicator } from '@wordpress/components';
import { Button, EmptyState, Notice, Text } from '@wordpress/ui';

/**
 * The banner shown while a token is selected (spec/screens/Styles.md).
 *
 * @param {Object} props
 * @param {Object} props.usage The token name, colour, places and artboards.
 */
export function UsageBanner( { usage } ) {
    const places = sprintf(
        /* translators: %d: number of places a token is used. */
        _n( '%d place', '%d places', usage.places, 'wordpress-for-designers' ),
        usage.places
    );
    const artboards = sprintf(
        /* translators: %d: number of artboards. */
        _n(
            '%d artboard',
            '%d artboards',
            usage.artboards,
            'wordpress-for-designers'
        ),
        usage.artboards
    );
    return (
        <Notice.Root
            intent="info"
            icon={ null }
            className="wfd-banner"
            data-wfd-banner="usage"
        >
            <Notice.Description className="wfd-banner__text">
                { usage.color && <ColorIndicator colorValue={ usage.color } /> }
                { sprintf(
                    /* translators: 1: token name. 2: for example "3 places". 3: for example "3 artboards". */
                    __(
                        'Showing where %1$s is used: %2$s on %3$s',
                        'wordpress-for-designers'
                    ),
                    usage.name,
                    places,
                    artboards
                ) }
            </Notice.Description>
        </Notice.Root>
    );
}

/**
 * The banner shown while a styles revision is previewed.
 *
 * @param {Object} props
 * @param {string} props.date The revision's date.
 * @param {string} props.time The revision's time.
 */
export function PreviewBanner( { date, time } ) {
    return (
        <Notice.Root
            intent="info"
            className="wfd-banner"
            data-wfd-banner="preview"
        >
            <Notice.Description>
                { sprintf(
                    /* translators: 1: date. 2: time. */
                    __(
                        'Previewing styles from %1$s, %2$s on every artboard',
                        'wordpress-for-designers'
                    ),
                    date,
                    time
                ) }
            </Notice.Description>
        </Notice.Root>
    );
}

/**
 * The dashed outline shown while placing or dropping an artboard.
 *
 * @param {Object} props
 * @param {Object} props.rect  Position and size in board units.
 * @param {string} props.label The artboard label.
 * @param {string} props.hint  "Click to place" or "Drop to open as an artboard".
 */
export function PlacementOutline( { rect, label, hint } ) {
    return (
        <div
            className="wfd-placement"
            style={ {
                left: rect.x,
                top: rect.y,
                width: rect.width,
                height: rect.height,
            } }
            data-wfd-placement
        >
            <div className="wfd-artboard__label is-live">
                <Text variant="body-sm" className="wfd-artboard__label-text">
                    { label }
                </Text>
            </div>
            <div className="wfd-placement__outline">
                <Text variant="heading-md" className="wfd-placement__hint">
                    { hint }
                </Text>
            </div>
        </div>
    );
}

/**
 * The empty board. Its button turns the inserter on (D49).
 *
 * @param {Object}   props
 * @param {Function} props.onAdd Called when "Add artboard" is pressed.
 */
export function EmptyBoard( { onAdd } ) {
    return (
        <EmptyState.Root className="wfd-canvas__empty">
            <EmptyState.Title>
                { __(
                    'This board has no artboards',
                    'wordpress-for-designers'
                ) }
            </EmptyState.Title>
            <EmptyState.Description>
                { __(
                    'Add a page, template, template part or pattern to start designing.',
                    'wordpress-for-designers'
                ) }
            </EmptyState.Description>
            <EmptyState.Actions>
                <Button variant="solid" tone="brand" onClick={ onAdd }>
                    { __( 'Add artboard', 'wordpress-for-designers' ) }
                </Button>
            </EmptyState.Actions>
        </EmptyState.Root>
    );
}

export const Canvas = forwardRef( function CanvasRegion(
    {
        surfaceRef,
        banner,
        emptyState,
        overlay,
        resizeListener,
        placer,
        children,
        ...props
    },
    ref
) {
    countRender();
    return (
        <div
            className="wfd-canvas"
            data-wfd-region="canvas"
            ref={ ref }
            tabIndex={ 0 }
            role="application"
            aria-label={ __( 'Board', 'wordpress-for-designers' ) }
            { ...props }
        >
            { resizeListener }
            <div className="wfd-canvas__surface" ref={ surfaceRef }>
                { children }
                { overlay }
                <div className="wfd-marquee" data-wfd-marquee hidden />
            </div>
            { banner && <div className="wfd-canvas__banner">{ banner }</div> }
            { placer }
            { emptyState }
        </div>
    );
} );
