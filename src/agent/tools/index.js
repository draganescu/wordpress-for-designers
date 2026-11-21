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
import blocksGet from './blocks-get';
import blockUpdate from './block-update';
import blocksInsert from './blocks-insert';
import blocksRemove from './blocks-remove';
import blocksMove from './blocks-move';
import stylesGet from './styles-get';
import tokenSet from './token-set';
import stylesSet from './styles-set';
import stylesSetVariation from './styles-set-variation';
import tokenShowUses from './token-show-uses';
import reviewList from './review-list';
import reviewDiscard from './review-discard';

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
    'blocks-get': blocksGet,
    'block-update': blockUpdate,
    'blocks-insert': blocksInsert,
    'blocks-remove': blocksRemove,
    'blocks-move': blocksMove,
    'styles-get': stylesGet,
    'token-set': tokenSet,
    'styles-set': stylesSet,
    'styles-set-variation': stylesSetVariation,
    'token-show-uses': tokenShowUses,
    'review-list': reviewList,
    'review-discard': reviewDiscard,
};
