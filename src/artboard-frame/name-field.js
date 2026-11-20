/**
 * A7: the text field a page or pattern is named in, in place of the name in
 * its artboard's label (D62). Enter or a click elsewhere keeps the name, Esc
 * leaves it as it was.
 *
 * This field and `src/shell/use-rename.js` are all of naming on the board:
 * the two to replace if WordPress comes to offer a rename of its own.
 */
import { __ } from '@wordpress/i18n';
import { useCallback, useRef, useState } from '@wordpress/element';
import { InputControl } from '@wordpress/ui';

/**
 * @param {Object}                                        props
 * @param {string}                                        props.name   The name as it is.
 * @param {(name: string|null, refocus: boolean) => void} props.onDone Called once, with the name typed and whether
 *                                                                     the board takes focus back, or with null
 *                                                                     when the name is left as it was.
 */
export function NameField( { name, onDone } ) {
    const [ value, setValue ] = useState( name );
    // Giving focus back to the board blurs the field, which must not end
    // the naming a second time.
    const isDone = useRef( false );
    const finish = ( result, refocus ) => {
        if ( ! isDone.current ) {
            isDone.current = true;
            onDone( result, refocus );
        }
    };
    const select = useCallback( ( input ) => {
        if ( input ) {
            input.focus( { preventScroll: true } );
            input.select();
        }
    }, [] );
    return (
        <InputControl
            ref={ select }
            className="wfd-artboard__name-field"
            data-wfd-name-field
            size="compact"
            label={ __( 'Name', 'wordpress-for-designers' ) }
            hideLabelFromVision
            value={ value }
            onChange={ ( event ) => setValue( event.target.value ) }
            onBlur={ () => finish( value, false ) }
            onKeyDown={ ( event ) => {
                // The keys the field owns go no further: Esc would also
                // leave edit, and undo would act on the content history.
                // Every other key is left to the board's shortcuts.
                const isUndo =
                    ( event.metaKey || event.ctrlKey ) &&
                    event.key.toLowerCase() === 'z';
                if ( event.key === 'Enter' ) {
                    event.preventDefault();
                    event.stopPropagation();
                    finish( value, true );
                } else if ( event.key === 'Escape' ) {
                    event.preventDefault();
                    event.stopPropagation();
                    finish( null, true );
                } else if ( isUndo ) {
                    event.stopPropagation();
                }
            } }
        />
    );
}
