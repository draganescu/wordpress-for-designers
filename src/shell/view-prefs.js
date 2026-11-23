/**
 * What one user sees of one board, kept in the browser and never on the
 * board: the pan and zoom, and whether rulers and guides are shown (D109).
 */
const { boardId, userId } = window.wfdConfig;

const VIEWPORT_KEY = `wfd/viewport/${ userId }/${ boardId }`;
const VIEW_KEY = `wfd/view/${ userId }/${ boardId }`;

function read( key ) {
    try {
        return JSON.parse( window.localStorage.getItem( key ) );
    } catch {
        // Nothing stored, or storage is not available.
        return null;
    }
}

function store( key, value ) {
    try {
        window.localStorage.setItem( key, JSON.stringify( value ) );
    } catch {
        // Storage is not available; the defaults apply next time.
    }
}

/**
 * @return {Object|null} The stored pan and zoom, or null with none.
 */
export function readStoredViewport() {
    const stored = read( VIEWPORT_KEY );
    return stored &&
        [ stored.x, stored.y, stored.zoom ].every( Number.isFinite )
        ? stored
        : null;
}

export function storeViewport( state ) {
    store( VIEWPORT_KEY, state );
}

/**
 * @return {Object} Whether rulers and guides are shown: { rulers, guides }.
 *                  With nothing stored, rulers are hidden and guides shown.
 */
export function readViewChoices() {
    const stored = read( VIEW_KEY );
    return {
        rulers: stored?.rulers === true,
        guides: stored?.guides !== false,
    };
}

export function storeViewChoices( choices ) {
    store( VIEW_KEY, choices );
}
