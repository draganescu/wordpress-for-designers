/**
 * One artboard on the board: position, label, selection outline and the
 * content of its tier.
 */
import { __, _x } from '@wordpress/i18n';
import { createContext, useEffect, useState } from '@wordpress/element';
import { chevronDown, rotateRight } from '@wordpress/icons';
import {
    Button,
    Icon,
    IconButton,
    InputControl,
    Menu,
    Notice,
    Text,
    VisuallyHidden,
} from '@wordpress/ui';
import { DEVICES, DEVICE_ORDER, KINDS } from '../shell/constants';
import {
    artboardLabel,
    labelAroundName,
    liveLabel,
    usesText,
} from '../shell/labels';
import { countRender } from '../shell/test-hooks';
import { normalizeAddress } from './browser';
import { NameField } from './name-field';

export { BrowserArtboard, browserTier } from './browser-artboard';
export { usePreview } from './preview';
export { TierContent } from './handover';

/**
 * The frame element of the artboard a component is rendered in.
 */
export const FrameElementContext = createContext( null );

const AGENT_ENDING = {
    working: __( 'Agent working', 'wordpress-for-designers' ),
    changed: __( 'Changed by agent', 'wordpress-for-designers' ),
};

const ERROR_KIND = {
    page: __( "Couldn't load this page.", 'wordpress-for-designers' ),
    template: __( "Couldn't load this template.", 'wordpress-for-designers' ),
    'template-part': __(
        "Couldn't load this template part.",
        'wordpress-for-designers'
    ),
    pattern: __( "Couldn't load this pattern.", 'wordpress-for-designers' ),
    media: __( "Couldn't load this image.", 'wordpress-for-designers' ),
};

/**
 * A media object: the image itself, filling its frame.
 *
 * @param {Object} props
 * @param {Object} props.record The attachment record.
 */
export function ArtboardMedia( { record } ) {
    if ( ! record?.source_url ) {
        return null;
    }
    return (
        <img
            className="wfd-artboard__media"
            src={ record.source_url }
            alt={ record.alt_text ?? '' }
            loading="lazy"
            decoding="async"
            draggable={ false }
        />
    );
}

/**
 * The error state shown in place of an artboard's content.
 *
 * @param {Object}   props
 * @param {string}   props.kind    The artboard kind.
 * @param {Function} props.onRetry Requests the entity again.
 */
export function ArtboardError( { kind, onRetry } ) {
    return (
        <div className="wfd-artboard__error">
            <Notice.Root intent="error">
                <Notice.Title>{ ERROR_KIND[ kind ] }</Notice.Title>
                <Notice.Description>
                    { __(
                        'Check your connection and try again.',
                        'wordpress-for-designers'
                    ) }
                </Notice.Description>
                <Notice.Actions>
                    <Notice.ActionButton onClick={ onRetry }>
                        { __( 'Retry', 'wordpress-for-designers' ) }
                    </Notice.ActionButton>
                </Notice.Actions>
            </Notice.Root>
        </div>
    );
}

/**
 * The address field of a browser being browsed (D55).
 *
 * @param {Object}   props
 * @param {string}   props.path      The address the browser is on.
 * @param {Function} props.onAddress Called with a typed address.
 * @param {Function} props.onReload  Reloads the page.
 */
function AddressControls( { path, onAddress, onReload } ) {
    const [ typed, setTyped ] = useState( path );
    useEffect( () => setTyped( path ), [ path ] );
    return (
        <>
            <form
                className="wfd-artboard__address"
                onSubmit={ ( event ) => {
                    event.preventDefault();
                    onAddress( normalizeAddress( typed ) );
                } }
            >
                <InputControl
                    label={ __( 'Address', 'wordpress-for-designers' ) }
                    hideLabelFromVision
                    size="compact"
                    value={ typed }
                    onChange={ ( event ) => setTyped( event.target.value ) }
                />
            </form>
            <IconButton
                icon={ rotateRight }
                label={ __( 'Reload', 'wordpress-for-designers' ) }
                variant="minimal"
                tone="brand"
                size="small"
                onClick={ onReload }
            />
        </>
    );
}

function Label( {
    artboard,
    isLive,
    uses,
    isChanged,
    agentMark,
    onDeviceChange,
    isRenaming,
    onRename,
    onAddress,
    onReload,
} ) {
    const separator = _x(
        '·',
        'separator between parts of an artboard label',
        'wordpress-for-designers'
    );
    // G2 and G3: what the agent is working on, and what it changed
    // (spec/agent/surface.md, Marks).
    const ending = AGENT_ENDING[ agentMark ] ? (
        <>
            { ' ' + separator + ' ' }
            <span className="wfd-artboard__label-agent">
                { AGENT_ENDING[ agentMark ] }
            </span>
        </>
    ) : null;
    // The label's text. While the artboard is named, its name is a text
    // field and the rest of the label stays as it is (A7).
    const text = ( isShort, given = null ) => {
        const suffix = (
            <>
                { given }
                { ending }
            </>
        );
        if ( ! isRenaming ) {
            return (
                <Text variant="body-sm" className="wfd-artboard__label-text">
                    { ( isShort ? liveLabel : artboardLabel )( artboard ) }
                    { suffix }
                </Text>
            );
        }
        const [ before, after ] = labelAroundName( artboard, isShort );
        return (
            <>
                { before && (
                    <Text
                        variant="body-sm"
                        className="wfd-artboard__label-text"
                    >
                        { before }
                    </Text>
                ) }
                <NameField name={ artboard.name } onDone={ onRename } />
                <Text variant="body-sm" className="wfd-artboard__label-text">
                    { after }
                    { suffix }
                </Text>
            </>
        );
    };
    if ( isLive ) {
        return (
            <div className="wfd-artboard__label is-live">
                { KINDS[ artboard.kind ].edit === 'browse' ? (
                    <AddressControls
                        path={ artboard.path }
                        onAddress={ onAddress }
                        onReload={ onReload }
                    />
                ) : (
                    text( true )
                ) }
                <Menu.Root>
                    <Menu.Trigger
                        render={
                            <Button
                                variant="outline"
                                tone="brand"
                                size="small"
                            />
                        }
                    >
                        { /* The label, read before the visible device. */ }
                        <VisuallyHidden>
                            { __(
                                'Artboard device',
                                'wordpress-for-designers'
                            ) }
                        </VisuallyHidden>
                        { DEVICES[ artboard.device ].label }
                        <Icon icon={ chevronDown } />
                    </Menu.Trigger>
                    <Menu.Popup>
                        <Menu.RadioGroup
                            value={ artboard.device }
                            onValueChange={ onDeviceChange }
                        >
                            { DEVICE_ORDER.map( ( device ) => (
                                <Menu.RadioItem
                                    key={ device }
                                    value={ device }
                                    closeOnClick
                                >
                                    <Menu.ItemLabel>
                                        { DEVICES[ device ].label }
                                    </Menu.ItemLabel>
                                </Menu.RadioItem>
                            ) ) }
                        </Menu.RadioGroup>
                    </Menu.Popup>
                </Menu.Root>
            </div>
        );
    }
    let suffix = null;
    if ( uses ) {
        suffix = (
            <>
                { ' ' + separator + ' ' }
                <span className="wfd-artboard__label-uses">
                    { usesText( uses ) }
                </span>
            </>
        );
    } else if ( isChanged ) {
        suffix = (
            <>
                { ' ' + separator + ' ' }
                <span className="wfd-artboard__label-changed">
                    { __( 'Changed', 'wordpress-for-designers' ) }
                </span>
            </>
        );
    }
    // With the uses of a token shown, the label has no device.
    return (
        <div className="wfd-artboard__label">{ text( !! uses, suffix ) }</div>
    );
}

/**
 * @param {Object}   props
 * @param {Object}   props.artboard       The artboard with its name.
 * @param {number}   props.width          Render width of its device.
 * @param {string}   props.tier           ghost, snapshot, preview, live or warm; media for a media object.
 * @param {boolean}  props.isSelected     Whether it is the selected artboard.
 * @param {number}   props.uses           Uses of the selected token, if any.
 * @param {boolean}  props.isChanged      Whether Review marks it as changed.
 * @param {boolean}  props.isAgentWorking Whether a running call of the agent names it (G2).
 * @param {boolean}  props.isAgentChanged Whether the agent changed the item it shows (G3).
 * @param {Function} props.onDeviceChange Changes the device from the Live label.
 * @param {boolean}  props.isRenaming     Whether its name is being typed in the label.
 * @param {Function} props.onRename       Ends renaming: see NameField.
 * @param {Object}   props.frameProps     Pointer handlers for the frame.
 * @param {boolean}  props.hasError       Whether the error state is shown.
 * @param {boolean}  props.isStale        Whether its Snapshot is out of date.
 * @param {Function} props.onAddress      A browser's typed address (D55).
 * @param {Function} props.onReload       Reloads a browser's page.
 * @param {Element}  props.guides         Its guides (D110), drawn over it in every tier; none when it has none.
 * @param {Element}  props.children       The tier content.
 */
export function ArtboardFrame( {
    artboard,
    width,
    tier,
    isSelected,
    uses,
    isChanged,
    isAgentWorking = false,
    isAgentChanged = false,
    onDeviceChange,
    isRenaming,
    onRename,
    frameProps,
    hasError,
    isStale,
    onAddress,
    onReload,
    guides,
    children,
} ) {
    countRender();
    const [ frameElement, setFrameElement ] = useState( null );
    const isLive = tier === 'live';
    const classes = [ 'wfd-artboard' ];
    if ( isSelected || isLive ) {
        classes.push( 'is-selected' );
    }
    if ( isChanged ) {
        classes.push( 'is-changed' );
    }
    // G3 is not shown while G2 is, or while Review adds "· Changed".
    let agentMark = null;
    if ( isAgentWorking ) {
        agentMark = 'working';
    } else if ( isAgentChanged && ! isChanged ) {
        agentMark = 'changed';
    }
    return (
        <div
            className={ classes.join( ' ' ) }
            style={ { left: artboard.x, top: artboard.y, width } }
            data-wfd-artboard={ artboard.id }
            data-wfd-tier={ tier }
            data-wfd-kind={ artboard.kind }
            data-wfd-device={ artboard.device }
            data-wfd-stale={ isStale ? 'true' : undefined }
            data-wfd-agent-working={ isAgentWorking ? 'true' : undefined }
            data-wfd-agent-changed={ isAgentChanged ? 'true' : undefined }
        >
            <Label
                artboard={ artboard }
                isLive={ isLive }
                uses={ uses }
                isChanged={ isChanged }
                agentMark={ agentMark }
                onDeviceChange={ onDeviceChange }
                isRenaming={ isRenaming }
                onRename={ onRename }
                onAddress={ onAddress }
                onReload={ onReload }
            />
            <div
                className={
                    'wfd-artboard__frame' + ( hasError ? ' has-error' : '' )
                }
                style={ { height: artboard.height } }
                ref={ setFrameElement }
                { ...frameProps }
            >
                <FrameElementContext.Provider value={ frameElement }>
                    { children }
                </FrameElementContext.Provider>
            </div>
            { KINDS[ artboard.kind ].isResized && ! isLive && (
                // The window's bottom edge resizes it (D56).
                <div className="wfd-artboard__resize" data-wfd-resize />
            ) }
            { guides && (
                // Over the content and the label, from the artboard's
                // top-left corner in the page's pixels.
                <div className="wfd-artboard__guides">{ guides }</div>
            ) }
        </div>
    );
}
