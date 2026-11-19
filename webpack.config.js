const path = require( 'path' );
const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );

module.exports = {
    ...defaultConfig,
    entry: {
        boards: path.resolve( __dirname, 'src/boards/index.js' ),
        board: path.resolve( __dirname, 'src/shell/index.js' ),
    },
};
