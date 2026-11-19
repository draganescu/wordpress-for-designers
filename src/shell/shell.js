/**
 * The shell layout: header, left panel, canvas area, right panel.
 *
 * @param {Object}  props
 * @param {Element} props.header   The header region.
 * @param {Element} props.left     The left panel content, or null when closed.
 * @param {Element} props.canvas   The canvas region.
 * @param {Element} props.right    The right panel content, or null when hidden.
 * @param {Element} props.overlays Drawers and dialogs.
 */
export function Shell( { header, left, canvas, right, overlays } ) {
    return (
        <div
            className={
                'wfd-shell' +
                ( left ? '' : ' has-no-left' ) +
                ( right ? '' : ' has-no-right' )
            }
        >
            { header }
            { /* One landmark for everything under the header. */ }
            <main className="wfd-body">
                { left && (
                    <section className="wfd-left" data-wfd-region="left">
                        { left }
                    </section>
                ) }
                <div className="wfd-main">{ canvas }</div>
                { right && (
                    <section className="wfd-right" data-wfd-region="right">
                        { right }
                    </section>
                ) }
            </main>
            { overlays }
        </div>
    );
}
