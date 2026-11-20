/**
 * Small layout pieces shared by the panels. Each is a composition of design
 * system components; none is a control of its own.
 */
import { Icon, Stack, Text } from '@wordpress/ui';
import { Item, ItemGroup } from '../adapter/experimental';

/**
 * A panel heading with an optional control at the right (L1, L5, S1).
 *
 * @param {Object}  props
 * @param {string}  props.title    The heading text.
 * @param {string}  props.variant  The Text variant.
 * @param {Element} props.children The control at the right.
 */
export function PanelHeader( { title, variant = 'heading-md', children } ) {
    return (
        <Stack
            className="wfd-panel-header"
            direction="row"
            align="center"
            justify="space-between"
            gap="sm"
        >
            <Text variant={ variant } render={ <h2 /> }>
                { title }
            </Text>
            { children }
        </Stack>
    );
}

/**
 * A group heading with an optional count or label at the right (L3, L9, S4)
 * and an optional control before it (S4 to S6).
 *
 * @param {Object}  props
 * @param {Element} props.children The heading text.
 * @param {*}       props.suffix   Count or label at the right.
 * @param {Element} props.action   A control at the right, before the suffix.
 * @param {string}  props.id       Id of the heading element.
 */
export function GroupHeading( { children, suffix, action, id } ) {
    const label = suffix !== undefined && (
        <Text variant="body-sm" className="wfd-group-heading__suffix">
            { suffix }
        </Text>
    );
    return (
        <Stack
            className="wfd-group-heading"
            direction="row"
            align="center"
            justify="space-between"
            gap="sm"
        >
            <Text variant="heading-sm" render={ <h3 id={ id } /> }>
                { children }
            </Text>
            { action ? (
                <Stack direction="row" align="center" gap="lg">
                    { action }
                    { label }
                </Stack>
            ) : (
                label
            ) }
        </Stack>
    );
}

/**
 * A list of rows (L4, L10).
 *
 * @param {Object}  props
 * @param {Element} props.children The rows.
 */
export function RowGroup( { children, ...props } ) {
    return (
        <ItemGroup className="wfd-rows" { ...props }>
            { children }
        </ItemGroup>
    );
}

/**
 * One row: icon, name, optional second line, optional text at the right.
 *
 * @param {Object}  props
 * @param {Element} props.icon       An icon element, or a rendered node.
 * @param {string}  props.name       The first line.
 * @param {string}  props.secondLine The optional second line.
 * @param {*}       props.suffix     Text at the right.
 * @param {boolean} props.isSelected Whether the row uses the brand surface.
 */
export function Row( {
    icon,
    name,
    secondLine,
    suffix,
    isSelected = false,
    ...props
} ) {
    return (
        <Item
            className={ 'wfd-row' + ( isSelected ? ' is-selected' : '' ) }
            aria-current={ isSelected ? 'true' : undefined }
            { ...props }
        >
            <Stack direction="row" align="center" gap="md">
                <span className="wfd-row__icon">
                    { icon?.type === 'svg' || icon?.props?.viewBox ? (
                        <Icon icon={ icon } />
                    ) : (
                        icon
                    ) }
                </span>
                <Stack direction="column" className="wfd-row__text">
                    <Text variant="body-md" className="wfd-row__name">
                        { name }
                    </Text>
                    { secondLine && (
                        <Text
                            variant="body-sm"
                            className="wfd-row__second-line"
                        >
                            { secondLine }
                        </Text>
                    ) }
                </Stack>
                { suffix !== undefined && (
                    <Text variant="body-md" className="wfd-row__suffix">
                        { suffix }
                    </Text>
                ) }
            </Stack>
        </Item>
    );
}

/**
 * Weak body text used for hints and help.
 *
 * @param {Object}  props
 * @param {Element} props.children  The text.
 * @param {string}  props.className Extra class.
 */
export function WeakText( { children, className = '', ...props } ) {
    return (
        <Text
            variant="body-sm"
            className={ 'wfd-weak ' + className }
            { ...props }
        >
            { children }
        </Text>
    );
}
