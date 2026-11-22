/**
 * `board-refresh`: read the site again (spec/agent/tools.md).
 */
import { actions } from '../board';
import { withinLimit } from '../limit';

export default async function boardRefresh() {
    await withinLimit( actions().refresh() );
    return { refreshed: true };
}
