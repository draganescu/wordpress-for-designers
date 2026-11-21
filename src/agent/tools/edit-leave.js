/**
 * `edit-leave`: leave edit and keep the artboard selected
 * (spec/agent/tools.md).
 */
import { editor } from '../edit';

export default function editLeave() {
    editor().leave();
    return { edit: null };
}
