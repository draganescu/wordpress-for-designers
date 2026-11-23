/**
 * Guides on the board and on its artboards (D110 to D114): the line itself,
 * what a drag draws, its settings in the right panel and the helper the
 * canvas uses for it.
 */
import { __, sprintf } from '@wordpress/i18n';
import { useEffect, useState } from '@wordpress/element';
import { lineSolid } from '@wordpress/icons';
import { Badge, Button, Icon, InputControl, Stack, Text } from '@wordpress/ui';
import { ATTR } from './constants';
import { WeakText } from './primitives';

/**
 * The positions an artboard's guide may have: it is kept within its
 * artboard (spec/data-model.md).
 *
 * @param {string}   axis     The guide's axis, 'x' or 'y'.
 * @param {Object}   artboard The artboard it belongs to; none for a board
 *                            guide.
 * @param {Function} widthOf  Gives the render width of a device.
 * @return {number[]|undefined} The lowest and the highest position; undefined
 *                              for a board guide, which goes anywhere.
 */
export function guideRange( axis, artboard, widthOf ) {
    if ( ! artboard ) {
        return undefined;
    }
    return [ 0, axis === 'x' ? widthOf( artboard.device ) : artboard.height ];
}

/**
 * The words of the Guide card (GD4) that depend on the guide.
 *
 * @param {string} axis         The guide's axis: 'y' is a horizontal guide.
 * @param {string} artboardName The name of its artboard; none for a board
 *                              guide.
 * @return {string[]} The description and the help of the "Position" field.
 */
function guideWords( axis, artboardName ) {
    if ( artboardName === undefined ) {
        return axis === 'y'
            ? [
                  __( 'Horizontal. On the board.', 'wordpress-for-designers' ),
                  __(
                      'Measured from the top of the board.',
                      'wordpress-for-designers'
                  ),
              ]
            : [
                  __( 'Vertical. On the board.', 'wordpress-for-designers' ),
                  __(
                      'Measured from the left of the board.',
                      'wordpress-for-designers'
                  ),
              ];
    }
    return axis === 'y'
        ? [
              sprintf(
                  /* translators: %s: artboard name. */
                  __( 'Horizontal. On %s.', 'wordpress-for-designers' ),
                  artboardName
              ),
              sprintf(
                  /* translators: %s: artboard name. */
                  __(
                      'Measured from the top of %s.',
                      'wordpress-for-designers'
                  ),
                  artboardName
              ),
          ]
        : [
              sprintf(
                  /* translators: %s: artboard name. */
                  __( 'Vertical. On %s.', 'wordpress-for-designers' ),
                  artboardName
              ),
              sprintf(
                  /* translators: %s: artboard name. */
                  __(
                      'Measured from the left of %s.',
                      'wordpress-for-designers'
                  ),
                  artboardName
              ),
          ];
}

/**
 * One guide (GD1, GD3). A board guide is a child of the canvas surface; an
 * artboard's guide is drawn in its artboard's frame.
 *
 * @param {Object}   props
 * @param {Object}   props.guide      The guide.
 * @param {boolean}  props.isSelected Whether it is selected.
 * @param {number[]} props.range      What `guideRange` gives for it.
 */
export function Guide( { guide, isSelected, range } ) {
    // A guide left past its artboard's height is kept and not drawn.
    if ( range && ( guide.at < range[ 0 ] || guide.at > range[ 1 ] ) ) {
        return null;
    }
    const classes = [ 'wfd-guide', `is-${ guide.axis }` ];
    if ( ! guide.artboard ) {
        classes.push( 'is-board' );
    }
    if ( isSelected ) {
        classes.push( 'is-selected' );
    }
    const attributes = {
        [ ATTR.guide ]: guide.id,
        [ ATTR.axis ]: guide.axis,
        [ ATTR.at ]: guide.at,
        [ ATTR.owner ]: guide.artboard,
        [ ATTR.device ]: guide.device,
        [ ATTR.selected ]: isSelected ? 'true' : undefined,
    };
    return (
        <div
            className={ classes.join( ' ' ) }
            style={ { [ guide.axis === 'x' ? 'left' : 'top' ]: guide.at } }
            { ...attributes }
        />
    );
}

/**
 * What a guide's drag draws on the canvas surface: the line of a guide
 * pulled out of a ruler, and the position chip beside the pointer (GD2).
 * Both are rendered once and driven through the DOM by the drag (C35).
 */
export function GuideDrag() {
    return (
        <>
            <div className="wfd-guide is-draft" hidden />
            <Badge
                className="wfd-guide-chip"
                hidden
                { ...{ [ ATTR.guideChip ]: true } }
            >
                { '' }
            </Badge>
        </>
    );
}

/**
 * The right panel with a guide selected (GD4).
 *
 * @param {Object}   props
 * @param {Object}   props.guide        The guide.
 * @param {string}   props.artboardName The name of its artboard; none for a
 *                                      board guide.
 * @param {number[]} props.range        What `guideRange` gives for it.
 * @param {Function} props.onMove       Called with a typed position.
 * @param {Function} props.onRemove     Takes the guide off the board.
 */
export function GuideSettings( {
    guide,
    artboardName,
    range,
    onMove,
    onRemove,
} ) {
    const [ typed, setTyped ] = useState( String( guide.at ) );
    // The field follows the guide. A drag writes the field itself.
    useEffect( () => setTyped( String( guide.at ) ), [ guide.id, guide.at ] );
    const keep = () => {
        const at = Number( typed );
        const isKept =
            /^-?\d+$/.test( typed.trim() ) &&
            ( ! range || ( at >= range[ 0 ] && at <= range[ 1 ] ) );
        if ( isKept && at !== guide.at ) {
            onMove( at );
        } else {
            setTyped( String( guide.at ) );
        }
    };
    const [ description, help ] = guideWords( guide.axis, artboardName );
    return (
        <div className="wfd-artboard-settings" data-wfd-panel="guide">
            <Stack
                className="wfd-entity-card"
                direction="row"
                gap="md"
                align="flex-start"
            >
                <Icon icon={ lineSolid } />
                <Stack direction="column">
                    <Text variant="heading-md" render={ <h2 /> }>
                        { __( 'Guide', 'wordpress-for-designers' ) }
                    </Text>
                    <WeakText>{ description }</WeakText>
                </Stack>
            </Stack>
            <Stack className="wfd-guide-position" direction="column" gap="sm">
                <InputControl
                    type="number"
                    step={ 1 }
                    min={ range?.[ 0 ] }
                    max={ range?.[ 1 ] }
                    label={ __( 'Position', 'wordpress-for-designers' ) }
                    suffix={
                        <WeakText className="wfd-guide-position__suffix">
                            { __( 'px', 'wordpress-for-designers' ) }
                        </WeakText>
                    }
                    value={ typed }
                    onChange={ ( event ) => setTyped( event.target.value ) }
                    onBlur={ keep }
                    onKeyDown={ ( event ) => {
                        if ( event.key === 'Enter' ) {
                            event.preventDefault();
                            keep();
                        }
                    } }
                />
                <WeakText>{ help }</WeakText>
            </Stack>
            <Stack
                className="wfd-artboard-settings__actions"
                direction="row"
                gap="md"
            >
                <Button variant="outline" tone="brand" onClick={ onRemove }>
                    { __( 'Remove guide', 'wordpress-for-designers' ) }
                </Button>
            </Stack>
            <WeakText className="wfd-artboard-settings__hint">
                { __(
                    'Drag moves it. Delete removes it.',
                    'wordpress-for-designers'
                ) }
            </WeakText>
        </div>
    );
}
