const path = require( 'path' );
const base = require( '../../webpack.config.js' );

module.exports = {
    ...base,
    entry: {
        board: path.resolve( __dirname, 'wfd-agent-spike/chunk/entry.js' ),
    },
    output: {
        ...base.output,
        path: path.resolve( __dirname, 'wfd-agent-spike/chunk-build' ),
    },
};
