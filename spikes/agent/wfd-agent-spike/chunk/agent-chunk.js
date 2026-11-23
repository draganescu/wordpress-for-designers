/**
 * Spike (d). Stands for src/agent/: code that is only in the chunk and uses
 * the page's own stores through WordPress's script globals.
 */
import { select } from '@wordpress/data';
import { store as blockEditorStore } from '@wordpress/block-editor';

window.wfdSpikeChunkRuns = ( window.wfdSpikeChunkRuns ?? 0 ) + 1;

export default {
    version: 1,
    marker: 'wfd-spike-agent-chunk-body',
    artboards: () => select( 'wfd/board' ).getArtboards().length,
    blockEditorStore: blockEditorStore.name,
};
