/**
 * `board-refresh`: read the site again (spec/agent/tools.md).
 */
import { actions } from '../board';

export default async function boardRefresh() {
    await actions().refresh();
    return { refreshed: true };
}
