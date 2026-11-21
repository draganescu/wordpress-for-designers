/**
 * The seams through which the agent surface reaches the rest of the client
 * (spec/agent/surface.md, Seams). Each is filled by the part that owns what
 * it gives, and read by `src/agent/` alone. With the surface not loaded
 * nothing reads them.
 */

/**
 * The editor in edit: the Live editor's bridge, which holds that editor's
 * registry, and the shell's own functions for entering and leaving edit.
 * Filled by the app.
 */
export const editSeam = { current: null };

/**
 * Board actions: the functions the controls named in spec/agent/tools.md
 * call, and what those controls show. Filled by the app.
 */
export const actionsSeam = { current: null };
