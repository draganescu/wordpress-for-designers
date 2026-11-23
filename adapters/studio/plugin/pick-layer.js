/**
 * The pick layer (adapters/studio/spec/pick-layer.md).
 *
 * While Studio's Annotate tool is on, one invisible element lies over each
 * thing the agent surface lists as a target. Its id is the target's
 * reference, so the selector Studio records for it is the reference.
 *
 * It uses `window.wfdAgent` and nothing else of the board, and of Studio only
 * the command event, the selector of an element with an id, and the
 * inspector picking the element under the pointer.
 */
( function () {
    'use strict';

    const COMMAND = '__studio-inspector-command';
    const LAYER_ID = 'wfd-studio-pick-layer';

    // Whether Annotate is on, as the last command said.
    let isOn = false;
    // The agent surface, the container and the subscription, while the
    // layer is up.
    let surface = null;
    let layer = null;
    let unsubscribe = null;
    // The children, in order: { ref, place, rest, element }.
    let children = [];
    // The animation frame a `resize` waits for.
    let resizeFrame = 0;

    /**
     * A label or a place as a class name.
     *
     * @param {string} text The text.
     * @return {string} The class, or an empty string.
     */
    function classOf( text ) {
        return String( text || '' )
            .toLowerCase()
            .replace( /[^\p{L}\p{N}]+/gu, '-' )
            .replace( /^-+|-+$/g, '' );
    }

    /**
     * What a child shows of a target.
     *
     * @param {Object} target A target of the agent surface.
     * @return {Object} `ref`, the rounded rectangle, the classes and the text,
     *                  with `place` and `rest` to compare two of them by.
     */
    function describe( target ) {
        const rect = {
            x: Math.round( target.rect.x ),
            y: Math.round( target.rect.y ),
            width: Math.round( target.rect.width ),
            height: Math.round( target.rect.height ),
        };
        const classes = [ classOf( target.label ), classOf( target.where ) ]
            .filter( Boolean )
            .join( ' ' );
        const text = [ target.label, target.where, target.text ]
            .filter( Boolean )
            .join( ' · ' );
        return {
            ref: target.ref,
            rect,
            classes,
            text,
            place: [ rect.x, rect.y, rect.width, rect.height ].join( ',' ),
            rest: JSON.stringify( [ classes, text ] ),
        };
    }

    /**
     * Writes a target's values to its element.
     *
     * @param {Element} element The child.
     * @param {Object}  now     What it shows, from `describe`.
     */
    function write( element, now ) {
        element.style.cssText =
            'position:absolute;' +
            'left:' +
            now.rect.x +
            'px;top:' +
            now.rect.y +
            'px;width:' +
            now.rect.width +
            'px;height:' +
            now.rect.height +
            'px;pointer-events:auto;color:transparent;font-size:1px;' +
            'overflow:hidden;-webkit-user-select:none;user-select:none;';
        if ( now.classes ) {
            element.className = now.classes;
        } else {
            element.removeAttribute( 'class' );
        }
        element.textContent = now.text;
    }

    /**
     * Has Studio place its markers again, at most once per animation frame.
     */
    function askForMarkers() {
        if ( resizeFrame ) {
            return;
        }
        resizeFrame = window.requestAnimationFrame( function () {
            resizeFrame = 0;
            if ( layer ) {
                window.dispatchEvent( new window.Event( 'resize' ) );
            }
        } );
    }

    /**
     * Brings the children in line with `targets()`.
     *
     * @return {boolean} Whether a child was added, removed or moved.
     */
    function sync() {
        const known = {};
        children.forEach( function ( child ) {
            known[ child.ref ] = child;
        } );
        const seen = {};
        let moved = false;
        const next = [];
        surface.targets().forEach( function ( target ) {
            const now = describe( target );
            if ( seen[ now.ref ] ) {
                return;
            }
            seen[ now.ref ] = true;
            let child = known[ now.ref ];
            if ( ! child ) {
                child = {
                    ref: now.ref,
                    element: document.createElement( 'div' ),
                };
                child.element.id = now.ref;
                write( child.element, now );
                moved = true;
            } else if ( child.place !== now.place || child.rest !== now.rest ) {
                write( child.element, now );
                moved = moved || child.place !== now.place;
            }
            child.place = now.place;
            child.rest = now.rest;
            next.push( child );
        } );
        children.forEach( function ( child ) {
            if ( ! seen[ child.ref ] ) {
                child.element.remove();
                moved = true;
            }
        } );
        // The order of `targets()`: a thing lies above what contains it.
        next.forEach( function ( child, index ) {
            const at = layer.children[ index ];
            if ( at !== child.element ) {
                layer.insertBefore( child.element, at || null );
                moved = moved || !! known[ child.ref ];
            }
        } );
        children = next;
        return moved;
    }

    function turnOn() {
        if ( ! window.wfdAgent ) {
            return;
        }
        isOn = true;
        window.wfdAgent.ready().then(
            function ( agent ) {
                if ( ! isOn || layer ) {
                    return;
                }
                surface = agent;
                surface.setAnnotating( true );
                layer = document.createElement( 'div' );
                layer.id = LAYER_ID;
                layer.style.cssText =
                    'position:fixed;top:0;right:0;bottom:0;left:0;' +
                    'pointer-events:none;z-index:2147483000;';
                document.body.appendChild( layer );
                children = [];
                sync();
                unsubscribe = surface.subscribe( function () {
                    if ( layer && sync() ) {
                        askForMarkers();
                    }
                } );
            },
            function () {
                isOn = false;
            }
        );
    }

    function turnOff() {
        isOn = false;
        // Turning on may have stopped part way: each step is undone only if
        // it was done, and a step that throws does not keep the others from
        // being undone.
        const steps = [
            function () {
                if ( layer ) {
                    layer.remove();
                }
            },
            function () {
                if ( unsubscribe ) {
                    unsubscribe();
                }
            },
            function () {
                if ( surface && surface.setAnnotating ) {
                    surface.setAnnotating( false );
                }
            },
        ];
        steps.forEach( function ( step ) {
            try {
                step();
            } catch ( error ) {
                window.console.error( error );
            }
        } );
        layer = null;
        children = [];
        unsubscribe = null;
        surface = null;
    }

    window.addEventListener( COMMAND, function ( event ) {
        const detail = event.detail;
        if ( ! detail || typeof detail.clearSelection === 'string' ) {
            return;
        }
        const active = detail.active === true;
        if ( active === isOn ) {
            return;
        }
        if ( active ) {
            turnOn();
        } else {
            turnOff();
        }
    } );
} )();
