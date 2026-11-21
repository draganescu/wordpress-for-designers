/**
 * The tool functions, by name. Each is paired with its entry of
 * includes/agent-tools.json; `tools/check-agent-tools.mjs` fails the build
 * when an entry has no function or a function has no entry.
 */
import boardGet from './board-get';
import boardSelect from './board-select';
import boardRefresh from './board-refresh';
import artboardAdd from './artboard-add';
import artboardNew from './artboard-new';
import artboardUpdate from './artboard-update';
import artboardRemove from './artboard-remove';
import artboardEdit from './artboard-edit';
import editLeave from './edit-leave';

export const functions = {
    'board-get': boardGet,
    'board-select': boardSelect,
    'board-refresh': boardRefresh,
    'artboard-add': artboardAdd,
    'artboard-new': artboardNew,
    'artboard-update': artboardUpdate,
    'artboard-remove': artboardRemove,
    'artboard-edit': artboardEdit,
    'edit-leave': editLeave,
};
