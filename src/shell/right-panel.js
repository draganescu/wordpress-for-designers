/**
 * Right panel: artboard settings (spec/screens/Selected.md) and the editing
 * tabs (E1 to E7).
 */
import { __, sprintf } from '@wordpress/i18n';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { SelectControl } from '@wordpress/components';
import { Button, Icon, Notice, Stack, Tabs, Text } from '@wordpress/ui';
import { InspectorSlot } from '../chrome-slots';
import {
    ToggleGroupControl,
    ToggleGroupControlOption,
} from '../adapter/experimental';
import { DEVICES, DEVICE_ORDER, KINDS } from './constants';
import { entityDescription } from './labels';
import { WeakText } from './primitives';

/**
 * E5: kind icon, name and description.
 *
 * @param {Object} props
 * @param {Object} props.artboard The artboard with its name.
 * @param {Object} props.info     Description and use count of its entity.
 */
export function EntityCard( { artboard, info } ) {
    return (
        <Stack
            className="wfd-entity-card"
            direction="row"
            gap="md"
            align="flex-start"
        >
            <Icon icon={ KINDS[ artboard.kind ].icon } />
            <Stack direction="column">
                <Text variant="heading-md" render={ <h2 /> }>
                    { artboard.name }
                </Text>
                <WeakText>{ entityDescription( artboard, info ) }</WeakText>
            </Stack>
        </Stack>
    );
}

/**
 * E6: the device control.
 *
 * @param {Object}   props
 * @param {string}   props.device   The current device.
 * @param {Function} props.onChange Called with the new device.
 * @param {string}   props.help     Optional help text.
 */
export function DeviceControl( { device, onChange, help } ) {
    return (
        <div className="wfd-device-control">
            <ToggleGroupControl
                __next40pxDefaultSize
                isBlock
                label={ __( 'Artboard device', 'wordpress-for-designers' ) }
                value={ device }
                onChange={ onChange }
                help={ help }
            >
                { DEVICE_ORDER.map( ( id ) => (
                    <ToggleGroupControlOption
                        key={ id }
                        value={ id }
                        label={ DEVICES[ id ].label }
                    />
                ) ) }
            </ToggleGroupControl>
        </div>
    );
}

const TEMPLATE_QUERY = { per_page: -1 };

/**
 * The page's template: "Default template" or one of the site's custom
 * templates. Changing it is an unsaved edit of the page.
 *
 * @param {Object} props
 * @param {number} props.pageId The page.
 */
export function PageTemplateControl( { pageId } ) {
    const { current, templates } = useSelect(
        ( select ) => {
            const core = select( coreStore );
            return {
                current:
                    core.getEditedEntityRecord( 'postType', 'page', pageId )
                        ?.template ?? '',
                templates:
                    core.getEntityRecords(
                        'postType',
                        'wp_template',
                        TEMPLATE_QUERY
                    ) ?? [],
            };
        },
        [ pageId ]
    );
    const { editEntityRecord } = useDispatch( coreStore );
    const options = [
        {
            value: '',
            label: __( 'Default template', 'wordpress-for-designers' ),
        },
        ...templates
            .filter( ( template ) => template.is_custom )
            .map( ( template ) => ( {
                value: template.slug,
                label:
                    template.title?.rendered ||
                    template.title?.raw ||
                    template.slug,
            } ) ),
    ];
    if ( current && ! options.some( ( option ) => option.value === current ) ) {
        // The page names a template that is not in the list.
        options.push( { value: current, label: current } );
    }
    return (
        <div className="wfd-template-control" data-wfd-template-control>
            <SelectControl
                __next40pxDefaultSize
                __nextHasNoMarginBottom
                label={ __( 'Template', 'wordpress-for-designers' ) }
                value={ current }
                options={ options }
                onChange={ ( template ) =>
                    editEntityRecord( 'postType', 'page', pageId, {
                        template,
                    } )
                }
            />
        </div>
    );
}

export function ArtboardSettings( {
    artboard,
    info,
    onDeviceChange,
    onEdit,
    onRemove,
    isBrowsing = false,
    onReload,
    onShowsChange,
} ) {
    if ( artboard.kind === 'browser' ) {
        // A browser browses instead of editing, and reloads (D55).
        return (
            <div className="wfd-artboard-settings" data-wfd-panel="settings">
                <EntityCard artboard={ artboard } info={ info } />
                <DeviceControl
                    device={ artboard.device }
                    onChange={ onDeviceChange }
                />
                <div className="wfd-device-control">
                    <ToggleGroupControl
                        __next40pxDefaultSize
                        isBlock
                        label={ __( 'Shows', 'wordpress-for-designers' ) }
                        value={ artboard.shows }
                        onChange={ onShowsChange }
                    >
                        <ToggleGroupControlOption
                            value="unsaved"
                            label={ __(
                                'Unsaved changes',
                                'wordpress-for-designers'
                            ) }
                        />
                        <ToggleGroupControlOption
                            value="saved"
                            label={ __(
                                'Saved site',
                                'wordpress-for-designers'
                            ) }
                        />
                    </ToggleGroupControl>
                </div>
                <Stack
                    className="wfd-artboard-settings__actions"
                    direction="row"
                    gap="md"
                    wrap="wrap"
                >
                    { ! isBrowsing && (
                        <Button variant="solid" tone="brand" onClick={ onEdit }>
                            { __( 'Browse', 'wordpress-for-designers' ) }
                        </Button>
                    ) }
                    <Button variant="outline" tone="brand" onClick={ onReload }>
                        { __( 'Reload', 'wordpress-for-designers' ) }
                    </Button>
                    <Button variant="outline" tone="brand" onClick={ onRemove }>
                        { __( 'Remove from board', 'wordpress-for-designers' ) }
                    </Button>
                </Stack>
                <WeakText className="wfd-artboard-settings__hint">
                    { __(
                        'Enter or double-click browses. Delete removes it from the board.',
                        'wordpress-for-designers'
                    ) }
                </WeakText>
            </div>
        );
    }
    if ( artboard.kind === 'media' ) {
        // A media object has no device and cannot be edited.
        return (
            <div className="wfd-artboard-settings" data-wfd-panel="settings">
                <EntityCard artboard={ artboard } info={ info } />
                <Stack
                    className="wfd-artboard-settings__actions"
                    direction="row"
                    gap="md"
                >
                    <Button variant="outline" tone="brand" onClick={ onRemove }>
                        { __( 'Remove from board', 'wordpress-for-designers' ) }
                    </Button>
                </Stack>
            </div>
        );
    }
    return (
        <div className="wfd-artboard-settings" data-wfd-panel="settings">
            <EntityCard artboard={ artboard } info={ info } />
            <DeviceControl
                device={ artboard.device }
                onChange={ onDeviceChange }
            />
            { artboard.kind === 'page' && (
                <PageTemplateControl pageId={ artboard.entityId } />
            ) }
            <Stack
                className="wfd-artboard-settings__actions"
                direction="row"
                gap="md"
            >
                <Button variant="solid" tone="brand" onClick={ onEdit }>
                    { __( 'Edit', 'wordpress-for-designers' ) }
                </Button>
                <Button variant="outline" tone="brand" onClick={ onRemove }>
                    { __( 'Remove from board', 'wordpress-for-designers' ) }
                </Button>
            </Stack>
            <WeakText className="wfd-artboard-settings__hint">
                { __(
                    'Enter or double-click edits. Delete removes it from the board.',
                    'wordpress-for-designers'
                ) }
            </WeakText>
        </div>
    );
}

/**
 * E7: the caution notice for templates and template parts.
 *
 * @param {Object}  props
 * @param {Object}  props.artboard  The artboard.
 * @param {boolean} props.isArchive Whether the template is the Archive template.
 */
function LiveNotice( { artboard, isArchive } ) {
    let text = null;
    if ( artboard.kind === 'template-part' ) {
        text = __(
            'Template parts have no draft. Saving this one puts it live everywhere it is used.',
            'wordpress-for-designers'
        );
    } else if ( artboard.kind === 'template' ) {
        text = isArchive
            ? __(
                  'Templates have no draft. Saving this one puts it live on every archive of the site.',
                  'wordpress-for-designers'
              )
            : __(
                  'Templates have no draft. Saving this one puts it live on the site.',
                  'wordpress-for-designers'
              );
    }
    if ( ! text ) {
        return null;
    }
    return (
        <Notice.Root
            intent="warning"
            icon={ null }
            className="wfd-live-notice"
            data-wfd-live-notice
        >
            <Notice.Description>{ text }</Notice.Description>
        </Notice.Root>
    );
}

/**
 * E3: the scope switch of the Block tab.
 *
 * @param {Object}   props
 * @param {string}   props.blockTitle The selected block's title.
 * @param {string}   props.scope      'block' or 'all'.
 * @param {Function} props.onChange   Called with the new scope.
 */
export function ScopeSwitch( { blockTitle, scope, onChange } ) {
    return (
        <div className="wfd-scope-switch">
            <ToggleGroupControl
                __next40pxDefaultSize
                isBlock
                label={ __( 'Style applies to', 'wordpress-for-designers' ) }
                value={ scope }
                onChange={ onChange }
                help={ sprintf(
                    /* translators: %s: block title, for example "Navigation". */
                    __(
                        'Switch to change every %s block on the site.',
                        'wordpress-for-designers'
                    ),
                    blockTitle
                ) }
            >
                <ToggleGroupControlOption
                    value="block"
                    label={ __( 'This block', 'wordpress-for-designers' ) }
                />
                <ToggleGroupControlOption
                    value="all"
                    label={ sprintf(
                        /* translators: %s: block title, for example "Navigation". */
                        __( 'All %s', 'wordpress-for-designers' ),
                        blockTitle
                    ) }
                />
            </ToggleGroupControl>
        </div>
    );
}

const TEMPLATE_DEVICE_HELP = __(
    'The same three previews the editor has. Add the template again to see two devices side by side.',
    'wordpress-for-designers'
);

export function EditingPanel( {
    artboard,
    info,
    tab,
    onTabChange,
    onDeviceChange,
    blockTitle,
    scope,
    onScopeChange,
    blockStyles,
} ) {
    return (
        <Tabs.Root
            className="wfd-editing-panel"
            data-wfd-panel="editing"
            value={ tab }
            onValueChange={ onTabChange }
        >
            <Tabs.List variant="minimal">
                <Tabs.Tab value="entity">
                    { KINDS[ artboard.kind ].label }
                </Tabs.Tab>
                <Tabs.Tab value="block">
                    { __( 'Block', 'wordpress-for-designers' ) }
                </Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="entity">
                <EntityCard artboard={ artboard } info={ info } />
                <DeviceControl
                    device={ artboard.device }
                    onChange={ onDeviceChange }
                    help={
                        artboard.kind === 'template'
                            ? TEMPLATE_DEVICE_HELP
                            : undefined
                    }
                />
                { artboard.kind === 'page' && (
                    <PageTemplateControl pageId={ artboard.entityId } />
                ) }
                <LiveNotice
                    artboard={ artboard }
                    isArchive={ !! info?.isArchive }
                />
            </Tabs.Panel>
            <Tabs.Panel value="block" keepMounted>
                { blockTitle && (
                    <ScopeSwitch
                        blockTitle={ blockTitle }
                        scope={ scope }
                        onChange={ onScopeChange }
                    />
                ) }
                { scope === 'all' && blockStyles }
                <div hidden={ scope === 'all' }>
                    <InspectorSlot />
                </div>
            </Tabs.Panel>
        </Tabs.Root>
    );
}
