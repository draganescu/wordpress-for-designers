/**
 * The Add artboard menu (L2, spec/screens/AddArtboard.md).
 */
import { __ } from '@wordpress/i18n';
import { plus } from '@wordpress/icons';
import { Button, IconButton, Menu } from '@wordpress/ui';
import { KINDS } from './constants';

const DESCRIPTIONS = {
    page: __( 'Content at its own address.', 'wordpress-for-designers' ),
    template: __(
        'The layout many pages or posts share.',
        'wordpress-for-designers'
    ),
    'template-part': __(
        'A header, footer or other shared region.',
        'wordpress-for-designers'
    ),
    pattern: __(
        'A section to drop into any page or template.',
        'wordpress-for-designers'
    ),
    browser: __( 'The site as visitors see it.', 'wordpress-for-designers' ),
};

/**
 * Template purposes offered as new, with the slug each creates.
 */
export const PURPOSES = [
    { slug: 'archive', label: __( 'Archive', 'wordpress-for-designers' ) },
    {
        slug: 'search',
        label: __( 'Search results', 'wordpress-for-designers' ),
    },
    { slug: '404', label: __( 'Page: 404', 'wordpress-for-designers' ) },
    {
        slug: 'singular',
        label: __( 'Single item', 'wordpress-for-designers' ),
    },
    { slug: null, label: __( 'Custom', 'wordpress-for-designers' ) },
];

/**
 * @param {Object}   props
 * @param {string}   props.trigger           'icon' for L2, 'button' for the empty state.
 * @param {Array}    props.existingSlugs     Slugs of templates that exist on the site.
 * @param {Array}    props.existingTemplates Templates as { id, name, isOnBoard }.
 * @param {Function} props.onPick            Called with what was chosen.
 * @param {boolean}  props.open              Controlled open state, for fixed screens.
 * @param {boolean}  props.submenuOpen       Controlled submenu state, for fixed screens.
 */
export function AddArtboardMenu( {
    trigger = 'icon',
    existingSlugs = [],
    existingTemplates = [],
    onPick = () => {},
    open,
    submenuOpen,
} ) {
    const label = __( 'Add artboard', 'wordpress-for-designers' );
    const purposes = PURPOSES.filter(
        ( purpose ) => ! existingSlugs.includes( purpose.slug )
    );
    return (
        <Menu.Root open={ open }>
            <Menu.Trigger
                render={
                    trigger === 'icon' ? (
                        <IconButton
                            icon={ plus }
                            label={ label }
                            variant="minimal"
                            tone="neutral"
                            size="compact"
                            data-wfd-control="L2"
                        />
                    ) : (
                        <Button variant="solid" tone="brand" />
                    )
                }
            >
                { trigger === 'icon' ? undefined : label }
            </Menu.Trigger>
            <Menu.Popup className="wfd-add-menu">
                <Menu.Item
                    prefix={ <Menu.PrefixIcon icon={ KINDS.page.icon } /> }
                    onClick={ () => onPick( { kind: 'page' } ) }
                >
                    <Menu.ItemLabel>{ KINDS.page.label }</Menu.ItemLabel>
                    <Menu.ItemDescription>
                        { DESCRIPTIONS.page }
                    </Menu.ItemDescription>
                </Menu.Item>
                <Menu.SubmenuRoot open={ submenuOpen }>
                    <Menu.SubmenuTrigger
                        prefix={
                            <Menu.PrefixIcon icon={ KINDS.template.icon } />
                        }
                    >
                        <Menu.ItemLabel>
                            { KINDS.template.label }
                        </Menu.ItemLabel>
                        <Menu.ItemDescription>
                            { DESCRIPTIONS.template }
                        </Menu.ItemDescription>
                    </Menu.SubmenuTrigger>
                    <Menu.Popup className="wfd-add-menu__templates">
                        <Menu.Group>
                            <Menu.GroupLabel>
                                { __(
                                    'New template for',
                                    'wordpress-for-designers'
                                ) }
                            </Menu.GroupLabel>
                            { purposes.map( ( purpose ) => (
                                <Menu.Item
                                    key={ purpose.slug ?? 'custom' }
                                    onClick={ () =>
                                        onPick( {
                                            kind: 'template',
                                            purpose,
                                        } )
                                    }
                                >
                                    <Menu.ItemLabel>
                                        { purpose.label }
                                    </Menu.ItemLabel>
                                </Menu.Item>
                            ) ) }
                        </Menu.Group>
                        <Menu.Separator />
                        <Menu.Group>
                            <Menu.GroupLabel>
                                { __(
                                    'Already on the site',
                                    'wordpress-for-designers'
                                ) }
                            </Menu.GroupLabel>
                            { existingTemplates.map( ( template ) => (
                                <Menu.Item
                                    key={ template.id }
                                    disabled={ template.isOnBoard }
                                    suffix={
                                        template.isOnBoard
                                            ? __(
                                                  'On this board',
                                                  'wordpress-for-designers'
                                              )
                                            : __(
                                                  'Open as artboard',
                                                  'wordpress-for-designers'
                                              )
                                    }
                                    onClick={ () =>
                                        onPick( {
                                            kind: 'template',
                                            entityId: template.id,
                                            name: template.name,
                                        } )
                                    }
                                >
                                    <Menu.ItemLabel>
                                        { template.name }
                                    </Menu.ItemLabel>
                                </Menu.Item>
                            ) ) }
                        </Menu.Group>
                    </Menu.Popup>
                </Menu.SubmenuRoot>
                <Menu.Item
                    prefix={
                        <Menu.PrefixIcon
                            icon={ KINDS[ 'template-part' ].icon }
                        />
                    }
                    onClick={ () => onPick( { kind: 'template-part' } ) }
                >
                    <Menu.ItemLabel>
                        { KINDS[ 'template-part' ].label }
                    </Menu.ItemLabel>
                    <Menu.ItemDescription>
                        { DESCRIPTIONS[ 'template-part' ] }
                    </Menu.ItemDescription>
                </Menu.Item>
                <Menu.Item
                    prefix={ <Menu.PrefixIcon icon={ KINDS.pattern.icon } /> }
                    onClick={ () => onPick( { kind: 'pattern' } ) }
                >
                    <Menu.ItemLabel>{ KINDS.pattern.label }</Menu.ItemLabel>
                    <Menu.ItemDescription>
                        { DESCRIPTIONS.pattern }
                    </Menu.ItemDescription>
                </Menu.Item>
                <Menu.Item
                    prefix={ <Menu.PrefixIcon icon={ KINDS.browser.icon } /> }
                    onClick={ () => onPick( { kind: 'browser' } ) }
                >
                    <Menu.ItemLabel>{ KINDS.browser.label }</Menu.ItemLabel>
                    <Menu.ItemDescription>
                        { DESCRIPTIONS.browser }
                    </Menu.ItemDescription>
                </Menu.Item>
            </Menu.Popup>
        </Menu.Root>
    );
}
