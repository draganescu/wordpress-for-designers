/**
 * Drag blocks from anywhere (decision D40).
 *
 * A block that is not being edited moves when it is pressed anywhere, its
 * text included, and dragged. A press without a drag puts the caret where the
 * press was, and from then on dragging over the block's text selects text.
 *
 * This is the behaviour of the Gutenberg experiment "Drag blocks from
 * anywhere" (https://github.com/WordPress/gutenberg/pull/86911), layered over
 * the block editor WordPress ships. WordPress already moves a selected block
 * that is dragged by its body; this file only makes a press on a text block
 * count as such a drag, and adds the hover outline and cursors. It watches the
 * canvas document from outside and uses public selectors only.
 *
 * It stands down when WordPress has the behaviour switched on itself.
 *
 * To remove it once WordPress has the behaviour by default: delete this file,
 * the `DragAnywhere` element and the `DRAG_ANYWHERE_STYLES` entry in
 * `./index.js`, `hasCoreDragFromAnywhere` in `../adapter/experimental.js`, and
 * the AC-EDIT-11 test.
 */
import { useContext, useEffect } from '@wordpress/element';
import { useRegistry } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { FrameElementContext } from '../artboard-frame';
import { hasCoreDragFromAnywhere } from '../adapter/experimental';

const HOVER_CLASS = 'is-hovered-drag-anywhere';
const PRESSED_CLASS = 'is-pressed-to-drag';
const BLOCK = '.block-editor-block-list__block';

// Elements inside a block that keep their own pointer behaviour.
const INTERACTIVE_ELEMENTS =
    'button, input, textarea, select, label, summary, iframe, video, audio, [role="button"]';

// The outline is the one WordPress draws on a block that can be dragged by
// its body; the cursors replace the text cursor.
const CSS = `
${ BLOCK }.${ HOVER_CLASS }:not(.is-multi-selected){outline:none;}
${ BLOCK }.${ HOVER_CLASS }:not(.is-multi-selected)::after{content:"";position:absolute;pointer-events:none;top:0;right:0;bottom:0;left:0;outline-color:var(--wp-admin-theme-color);outline-style:solid;outline-width:calc(1 * var(--wp-admin-border-width-focus) / var(--wp-block-editor-iframe-zoom-out-scale, 1));outline-offset:calc(1 * -1 * var(--wp-admin-border-width-focus) / var(--wp-block-editor-iframe-zoom-out-scale, 1));box-shadow:inset 0 0 0 calc(1 * var(--wp-admin-border-width-focus) / var(--wp-block-editor-iframe-zoom-out-scale, 1) + 0.5px) rgba(255, 255, 255, 0.7);z-index:1;}
.block-editor-block-list__layout ${ BLOCK }.${ HOVER_CLASS },.block-editor-block-list__layout ${ BLOCK }.${ HOVER_CLASS } [contenteditable]{cursor:grab;}
.block-editor-block-list__layout ${ BLOCK }.${ PRESSED_CLASS },.block-editor-block-list__layout ${ BLOCK }.${ PRESSED_CLASS } *{cursor:grabbing;user-select:none;}
`;

/**
 * Styles for the canvas document, passed to `BlockCanvas`.
 */
export const DRAG_ANYWHERE_STYLES = [ { css: CSS } ];

const elementOf = ( node ) =>
    node?.nodeType === 1 ? node : ( node?.parentElement ?? null );

/**
 * Whether the block is being edited: the caret, or keyboard focus, is in one
 * of its fields, as opposed to on the block itself or elsewhere.
 *
 * @param {HTMLElement} node The block's element.
 * @return {boolean} Whether it is being edited.
 */
function isEditingBlock( node ) {
    const doc = node.ownerDocument;
    const focused = doc.querySelector( ':focus' );
    // A field of the block has focus. The block itself can be the field, as a
    // Paragraph is; otherwise focus on the block is not editing. Only the
    // innermost block that contains the focus is being edited.
    if (
        focused &&
        node.contains( focused ) &&
        focused.closest( '[data-block]' ) === node &&
        ( focused.isContentEditable || focused !== node )
    ) {
        return true;
    }
    // While a text block is selected, WordPress makes the wrapper around the
    // blocks the editing host and gives it focus, so the caret tells which
    // block is being edited.
    if ( ! node.classList.contains( 'is-selected' ) ) {
        return false;
    }
    const element = elementOf( doc.defaultView.getSelection().anchorNode );
    return (
        !! element &&
        node.contains( element ) &&
        element.closest( '[data-block]' ) === node &&
        element.isContentEditable
    );
}

/**
 * Places the caret at a point of the canvas, if the point is in a field.
 *
 * @param {Document} doc The canvas document.
 * @param {number}   x   Horizontal position in its viewport.
 * @param {number}   y   Vertical position in its viewport.
 */
function placeCaretAtPoint( doc, x, y ) {
    let range = null;
    if ( doc.caretPositionFromPoint ) {
        const point = doc.caretPositionFromPoint( x, y );
        if ( point ) {
            range = doc.createRange();
            range.setStart( point.offsetNode, point.offset );
            range.collapse( true );
        }
    } else if ( doc.caretRangeFromPoint ) {
        range = doc.caretRangeFromPoint( x, y );
    }
    const editable = elementOf( range?.startContainer )?.closest(
        '[contenteditable="true"]'
    );
    if ( ! range || ! editable ) {
        return;
    }
    editable.focus();
    const selection = doc.defaultView.getSelection();
    selection.removeAllRanges();
    selection.addRange( range );
}

/**
 * Adds the behaviour to one canvas document.
 *
 * @param {Document} doc      The canvas document.
 * @param {Object}   registry The editor's registry.
 * @return {Function} Removes it again.
 */
function attach( doc, registry ) {
    const select = () => registry.select( blockEditorStore );

    // Whether a press on the block would drag it.
    const canPressToDrag = ( node, target ) => {
        const clientId = node.dataset.block;
        return (
            select().canMoveBlock( clientId ) &&
            ! select().hasSelectedInnerBlock( clientId, true ) &&
            ! select().hasMultiSelection() &&
            ! isEditingBlock( node ) &&
            ! target.closest( INTERACTIVE_ELEMENTS )
        );
    };

    let endPress = null;

    /**
     * For the length of the press, takes the fields under it out of editing
     * and makes the block draggable, so the browser starts a drag of the
     * block, which WordPress then handles as a drag by the block's body,
     * instead of placing a caret or selecting text.
     *
     * @param {MouseEvent} event Mouse down event.
     */
    function onMouseDown( event ) {
        endPress?.();
        const target = elementOf( event.target );
        // The innermost block under the press handles it.
        const node = target?.closest( '[data-block]' );
        if (
            ! node ||
            event.button !== 0 ||
            event.shiftKey ||
            event.metaKey ||
            event.ctrlKey ||
            event.altKey ||
            ! canPressToDrag( node, target )
        ) {
            return;
        }
        const editables = [
            // The wrapper around the blocks, while it is the editing host.
            node.parentElement?.closest( '[contenteditable="true"]' ),
            target.closest( '[contenteditable="true"]' ),
            ...node.querySelectorAll( '[contenteditable="true"]' ),
        ].filter(
            ( element, index, all ) =>
                element && all.indexOf( element ) === index
        );
        if ( ! editables.length ) {
            // A block without fields, such as an Image, drags from a press
            // already.
            return;
        }
        for ( const element of editables ) {
            element.contentEditable = 'false';
        }
        const hadDraggable = node.getAttribute( 'draggable' );
        node.setAttribute( 'draggable', 'true' );
        node.classList.add( PRESSED_CLASS );

        // WordPress handles a drag by the body only on the selected block,
        // and only while the block itself has focus. The press selects the
        // block; focus is given when the drag starts, because the press
        // itself leaves it on the canvas.
        const clientId = node.dataset.block;
        if ( ! select().isBlockSelected( clientId ) ) {
            registry.dispatch( blockEditorStore ).selectBlock( clientId, null );
        }
        const hadTabIndex = node.hasAttribute( 'tabindex' );

        let hasDragged = false;
        const { clientX, clientY } = event;
        const onDragStarted = ( dragEvent ) => {
            if (
                elementOf( dragEvent.target )?.closest(
                    '[draggable="true"]'
                ) !== node
            ) {
                return;
            }
            hasDragged = true;
            if ( ! hadTabIndex ) {
                node.setAttribute( 'tabindex', '-1' );
            }
            node.focus( { preventScroll: true } );
        };
        const restore = () => {
            endPress = null;
            node.classList.remove( PRESSED_CLASS, HOVER_CLASS );
            if ( hadDraggable === null ) {
                node.removeAttribute( 'draggable' );
            } else {
                node.setAttribute( 'draggable', hadDraggable );
            }
            for ( const element of editables ) {
                element.contentEditable = 'true';
            }
            if ( ! hadTabIndex ) {
                node.removeAttribute( 'tabindex' );
            }
            doc.removeEventListener( 'mouseup', onRelease );
            doc.removeEventListener( 'dragstart', onDragStarted, true );
            doc.removeEventListener( 'dragend', restore );
        };
        function onRelease() {
            restore();
            if ( ! hasDragged ) {
                placeCaretAtPoint( doc, clientX, clientY );
            }
        }
        endPress = restore;
        doc.addEventListener( 'mouseup', onRelease );
        doc.addEventListener( 'dragstart', onDragStarted, true );
        doc.addEventListener( 'dragend', restore );
    }

    let hovered = null;
    let timer;
    const clearHover = () => {
        // The document has no window once its iframe has left the page,
        // as when an artboard in edit is taken off the board.
        doc.defaultView?.clearTimeout( timer );
        hovered?.classList.remove( HOVER_CLASS );
        hovered = null;
    };

    // Over the text of a block that is not being edited, the block shows its
    // outline and the grab cursor.
    function onMouseOver( event ) {
        const target = elementOf( event.target );
        const node = target?.closest( '[data-block]' ) ?? null;
        if ( node !== hovered ) {
            clearHover();
        }
        doc.defaultView.clearTimeout( timer );
        if ( ! node ) {
            return;
        }
        hovered = node;
        timer = doc.defaultView.setTimeout( () => {
            node.classList.toggle(
                HOVER_CLASS,
                target.isContentEditable && canPressToDrag( node, target )
            );
        }, 100 );
    }

    // Once the caret is in the block its text selects again.
    function onEdit() {
        if ( hovered && isEditingBlock( hovered ) ) {
            hovered.classList.remove( HOVER_CLASS );
        }
    }

    doc.addEventListener( 'mousedown', onMouseDown );
    doc.addEventListener( 'mouseover', onMouseOver );
    doc.addEventListener( 'mouseleave', clearHover );
    doc.addEventListener( 'focusin', onEdit );
    doc.addEventListener( 'click', onEdit );
    return () => {
        endPress?.();
        clearHover();
        doc.removeEventListener( 'mousedown', onMouseDown );
        doc.removeEventListener( 'mouseover', onMouseOver );
        doc.removeEventListener( 'mouseleave', clearHover );
        doc.removeEventListener( 'focusin', onEdit );
        doc.removeEventListener( 'click', onEdit );
    };
}

/**
 * Renders nothing. Mounted inside the Live editor's `BlockEditorProvider`.
 */
export function DragAnywhere() {
    const frame = useContext( FrameElementContext );
    const registry = useRegistry();
    useEffect( () => {
        if ( ! frame || hasCoreDragFromAnywhere() ) {
            return;
        }
        let watched = null;
        let detach = () => {};
        const find = () => {
            const doc = frame.querySelector(
                'iframe[name="editor-canvas"]'
            )?.contentDocument;
            if (
                ! doc?.body?.querySelector( '.is-root-container' ) ||
                doc === watched
            ) {
                return;
            }
            detach();
            watched = doc;
            detach = attach( doc, registry );
        };
        // The canvas document is filled in after the iframe loads.
        const timer = window.setInterval( find, 100 );
        find();
        return () => {
            window.clearInterval( timer );
            detach();
        };
    }, [ frame, registry ] );
    return null;
}
