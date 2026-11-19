# Zoom-edit inventory: block tools that depend on the iframe's scale

Source read: the files shipped in the running WordPress 7.2-RC2 container
(`wp-includes/js/dist/block-editor.js`, `components.js`, `compose.js`, `dom.js`,
`rich-text.js`, `block-library.js`, `css/dist/block-editor/{style,content}.css`).
Line numbers below are for those shipped files. Nothing here was run in a browser;
every "expected" is a reading of the source, not a measurement.

Structures compared:

- (a) transform on an ancestor of the whole BlockCanvas (tools + iframe scaled together, "naive")
- (b) iframe element only is scaled; tools sit at net scale 1 ("counter": ancestor scale(z),
  wrapper around BlockCanvas scale(1/z), iframe scale(z))
- (c) html element inside the iframe is scaled ("inner")

## 1. How a popover anchor inside the iframe is resolved

`components.js` 8863-8915, floating-ui `getBoundingClientRect(element, includeScale, isFixed, offsetParent)`:

    let currentIFrame = getFrameElement(currentWin);
    while (currentIFrame && offsetWin !== currentWin) {
        const iframeScale = getScale(currentIFrame);          // rect.width / css width
        const iframeRect  = currentIFrame.getBoundingClientRect();
        const left = iframeRect.left + (clientLeft + paddingLeft) * iframeScale.x;
        x *= iframeScale.x;  y *= iframeScale.y;
        width *= iframeScale.x;  height *= iframeScale.y;
        x += left;  y += top;
        ...

So floating-ui uses BOTH the iframe's offset and its scale. `getScale` (8822) is
`iframe.getBoundingClientRect().width / computed css width`, so it sees any transform on the
iframe element or on its ancestors (net). The traversal runs only when the anchor resolves to a
DOM element: a real element, or a virtual anchor with `contextElement`
(`unwrapElement`, 8819). All block-editor anchors qualify: `BlockPopover` (98816-98824),
`BlockPopoverInbetween` (98632-98634), rich-text `useAnchor` (`rich-text.js` 3257).
A virtual anchor without `contextElement` (deprecated `anchorRect` / `getAnchorRect`, a bare
Range) would get no iframe offset and no scale at all.

It does NOT see a transform inside the iframe document as a scale of the frame: under (c) the
anchor's own `getBoundingClientRect()` is already scaled, and iframeScale is 1, so the result
is also right.

The floating element's side: `getScale(offsetParent)` (8872-8879, 8960) divides by the scale
of the popover's offset parent, but the iframe offset `left/top` is added after that division
and is not divided. With a scaled offset parent (structure (a)) popovers are therefore both
drawn scaled and offset wrongly. This is the naive-mode link popover failure in
spec/spike-report.md.

Popovers re-measure every animation frame (`autoUpdate(..., { animationFrame: true })`,
`components.js` 28407), so they follow pan and zoom changes of the surface without help.

## 2. What does not go through floating-ui

1. `CoverContainer` (`block-editor.js` 98893-98917): `width = selectedElement.offsetWidth`,
   `height = selectedElement.offsetHeight`, refreshed by a ResizeObserver. Layout px, blind to
   every transform. Its content is authored in the block's layout px (computed CSS values).
2. `cloneEvent` (`block-editor.js` 74343-74371), used by `useBubbleEvents` (74414) to re-dispatch
   `dragover, mousemove, pointerdown, mousedown, click, keydown` from the iframe document on the
   iframe element: `init.clientX += rect.left; init.clientY += rect.top`. Offset only, no scale.
   With the iframe scaled by z the bubbled coordinate is `rect.left + localX` while the pointer is
   really at `rect.left + localX * z`.
3. Everything that runs wholly inside the iframe document (local event coords against local
   rects): unaffected by (a) and (b).

## 3. Where things render

`BlockCanvas` -> `ExperimentalBlockCanvas` (107083) -> `BlockTools` wrapper div
(`style={ height, display: flex }`, 106586) containing, in order: inline `InsertionPoint`,
inline `EmptyBlockInserter`, (`BlockToolbarPopover` and `Popover.Slot name="block-toolbar"` only
when `hasFixedToolbar` is false), the iframe, `Popover.Slot name="__unstable-block-tools-after"`.

- Inline (inside the BlockTools wrapper, not in a slot): InsertionPoint (inbetween and drop-zone
  cover), EmptyBlockInserter. `inline: !__unstablePopoverSlot` (98725, 98837) and neither passes a slot.
- Slot `__unstable-block-tools-after` (inside the BlockTools wrapper): every Popover rendered from
  a block's edit component (slot name provided by context at 73806 and 119663): link UI, rich-text
  format popovers, autocomplete, block-rendered Dropdowns; plus GridVisualizer, GridItemResizer,
  ResizableBoxPopover (Cover block).
- Slot `block-toolbar`: the app sets `hasFixedToolbar: true` (src/artboard-editor/index.js 268), so
  this slot is not rendered. Popovers that ask for it (Margin/Padding visualizers, 132772) fall
  through to `.components-popover__fallback-container` appended to `document.body`
  (`components.js` 28560-28566). They are outside the artboard and outside any wrapper.
- Default slot `Popover` (app root, src/shell/app.js 876): popovers opened from the header
  BlockToolbar, the inspector, the inserter toggle's quick inserter.
- Inside the iframe: block outlines, appenders, in-iframe ResizableBox handles, the in-canvas block
  drag clone, the in-between hover detector, drop-zone hit maths.

## 4. Inventory

| # | Tool | Renders | Measurement | (a) ancestor | (b) iframe only | (c) html in iframe | Trigger |
|---|---|---|---|---|---|---|---|
| 1 | BlockPopover (base; block toolbar popover, off in this app) | parent, slot or inline in BlockTools | floating-ui, anchor `getElementBounds(block)` with contextElement | wrong offset, scaled UI | correct | correct | select a block with hasFixedToolbar false |
| 2 | Popovers from block edits (link, format, slash autocomplete, quick inserter from an in-canvas appender) | parent, slot `__unstable-block-tools-after` | floating-ui, element or contextElement anchor | wrong offset, scaled UI | correct | correct | Cmd+K, type `/`, click an appender |
| 3 | BlockPopoverInbetween / InsertionPoint line and its + button | parent, inline in BlockTools | floating-ui `overlay` placement; size from `rects.reference` (scaled by the frame traversal) | wrong | correct, 24 px button on a scaled gap | correct | hover the gap between two blocks; drag a block between two blocks |
| 4 | In-between hover detector (`useInBetweenInserter`, 99195) | inside iframe | iframe-local `event.clientX/Y` against iframe-local rects | correct | correct | correct | same as 3 |
| 5 | BlockPopoverCover position | parent | floating-ui top-start of block rect | wrong | correct | correct | any cover below |
| 6 | CoverContainer size (all covers) | parent | `offsetWidth/offsetHeight` | size right in layout terms but everything double-handled | 1/z too large | 1/z too large | any cover below |
| 7 | EmptyBlockInserter (+ at right end of empty paragraph) | parent, inline in BlockTools | cover; button `position:absolute; right:0` of the cover | wrong | button lands at left + offsetWidth instead of left + offsetWidth*z | same as (b) | select an empty paragraph |
| 8 | BlockDropZonePopover (`operation: replace`) | parent, inline in BlockTools | cover, foreground `inset:0` | wrong | highlight 1/z too large | same | drag a block or file over an empty default paragraph |
| 9 | Margin / Padding visualizer | parent, `document.body` fallback container | cover; borders from computed px of the block | n/a (outside the ancestor): 1/z too large and unscaled | 1/z too large | 1/z too large | Inspector > Dimensions: change or hover padding / margin |
| 10 | GridVisualizer | parent, slot after | cover; `grid-template-*`, gap, inset copied from computed px | wrong | 1/z too large | 1/z too large | select a Grid block or one of its children |
| 11 | GridItemResizer | parent, slot after | cover + ResizableBox 100%; on stop uses `offsetLeft/offsetWidth` against track px | wrong | 1/z too large; drag delta is screen px applied as layout px | same | select a child of a Grid block, drag an edge handle |
| 12 | ResizableBoxPopover (Cover block height handle) | parent, slot after | cover + ResizableBox, reads `elt.clientHeight` | wrong | 1/z too large; drag delta screen px as layout px | same | select a Cover block, drag the bottom handle |
| 13 | ResizableBox inside block edits (Image, Spacer, Media & Text, Site Logo, Avatar, Search, File) | inside iframe | re-resizable on the iframe window, local coords | correct | correct | pointer delta is scaled px applied as layout px: handle lags by 1/z | select an Image or Spacer, drag a handle |
| 14 | Drop target maths (`useBlockDropZone`, `getDropTargetPosition`, 99917, 100158) | inside iframe | iframe-local dragover coords against iframe-local rects | correct | correct | correct | drag a block over the canvas |
| 15 | Direct in-canvas block drag clone (67806-67960) | inside iframe | local coords; compensates only for the CSS `scale` property of an ancestor inside the iframe | correct | correct | correct only if (c) uses the `scale` property, drifts with `transform: scale()` | drag a selected non-text block in the canvas |
| 16 | Drag chip (`Draggable` + `BlockDraggableChip`, `components.js` 65760-65860) | parent `document.body` | parent `dragover` clientX/Y; over the iframe these are the bubbled, unscaled-offset clones (section 2.2) | chip offset wrong over the iframe | chip offset wrong over the iframe: sits at `rect.left + (x - rect.left)/z` | correct (frame is unscaled) | drag from the inserter library or from List View over the artboard |
| 17 | `useScrollWhenDragging` (101891) | parent | same bubbled clientY, parent scroll container | velocity off | velocity off; canvas has nothing to scroll | fine | same as 16 |
| 18 | Typing reset on mouse move (`useMouseMoveTypingReset`, on the iframe element) | parent | compares successive bubbled clientX/Y for change only | fine | fine | fine | type, then move the mouse |
| 19 | `useScrollIntoView` on selection (68032) and focus() | inside iframe | `IntersectionObserver` then `node.scrollIntoView()`; also scrolls scrollable ancestors of the iframe in the parent, including `overflow:hidden` ones | scale-independent risk | same | same | select an off-screen block from List View |
| 20 | `useBlockToolbarPopoverProps.getProps` (101685) | parent | block rect and content rect both iframe-local; `popoverNode.offsetHeight` parent px | flip decision slightly off | same, harmless for zero-height covers | same | with 1 and 7 |
| 21 | `getElementBounds` clamp to `viewport.innerWidth` (67330) | inside iframe | iframe-local | fine | fine | fine for z <= 1 | - |
| 22 | Iframe `scale` / `useScaleCanvas` (73984-74268) and store `zoomLevel` | sets class and CSS vars on the iframe html; content.css 861-863 applies `scale:` | - | - | - | this is core's own form of (c) | private only |
| 23 | Tooltips of controls rendered inside the iframe | inside iframe (not checked in source in detail) | - | scaled | scaled with the canvas (small at 30%) | scaled | hover an in-canvas button |
| 24 | List View, Block Inspector, header BlockToolbar and their popovers | parent, outside the artboard | parent-only | unaffected | unaffected | unaffected | - |

## 5. Public knobs

- `BlockCanvas` (107170): `children`, `height`, `styles` only. `styles` is the one public way to put
  CSS into the iframe document. No `iframeProps`, no `contentRef`, no scale.
- `ExperimentalBlockCanvas` (private, 107083): adds `iframeProps` (spread on `Iframe`, so `scale`,
  `frameSize`, `style`, `className`), `contentRef`, `shouldIframe`. Reads private `getZoomLevel()`;
  when it is not 100 it passes `scale: zoomLevel, frameSize: "40px"`.
- `__unstableIframe` (public export, not on the allowlist): `scale` (number or `"auto-scaled"`),
  `frameSize`, `contentRef`, `readonly`. When `scale !== 1` it adds `is-zoomed-out` to the iframe
  html and sets `--wp-block-editor-iframe-zoom-out-*`; `content.css` 861-867 then applies
  `scale: var(--wp-block-editor-iframe-zoom-out-scale)` plus a centring translateX, frame padding and
  a negative margin-bottom. It does not fix CoverContainer: core avoids the problem only because
  store zoom-out mode hides those tools.
- Store: `zoomLevel` reducer (8477); `setZoomLevel` / `resetZoomLevel` / `getZoomLevel` / `isZoomOut`
  and `useZoomOut` are private (unlock). Setting it also switches the editor into zoom-out mode
  (section selection, no InsertionPoint, no in-between inserter), which is not wanted here.
- Editor settings that change the tool set: `hasFixedToolbar` (removes the toolbar popover and the
  `block-toolbar` slot), `isDistractionFree` (removes InsertionPoint, in-between inserter,
  GridVisualizer), `isPreviewMode`.
- CSS custom properties: none that feed CoverContainer or cloneEvent. Classes available to target
  from plugin CSS: `.block-editor-block-popover`, `.block-editor-block-list__block-side-inserter-popover`,
  `.block-editor-block-popover__drop-zone`, `.block-editor-grid-visualizer`,
  `.block-editor-grid-item-resizer`, `.block-library-cover__resizable-box-popover`,
  `.block-editor-block-list__empty-block-inserter`, `.components-popover__fallback-container`.
  CoverContainer itself has no class: it is the only child `div` of `.components-popover__content`
  and carries inline `position: absolute; width; height`.

## 6. Recommendation

Structure (b), plus one plugin CSS rule that turns every CoverContainer into a scaled copy of its
block. See the recipe returned with this inventory. Not yet measured.
