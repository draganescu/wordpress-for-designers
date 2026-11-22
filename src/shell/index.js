/**
 * Entry point of the board app.
 */
import { createRoot } from '@wordpress/element';
import { getQueryArg } from '@wordpress/url';
import { ThemeProvider } from '@wordpress/theme';
import { App } from './app';
import { SpaceGate } from './space-gate';
import { startAgentStub } from './agent-stub';
import { StaticScreen } from '../static';
import './style.scss';

const root = document.getElementById( 'wfd-board-root' );
const screen =
    window.wfdConfig.isTestBuild &&
    getQueryArg( window.location.href, 'wfd-screen' );

if ( root && ! screen ) {
    startAgentStub();
}

if ( root ) {
    createRoot( root ).render(
        <ThemeProvider>
            { screen ? (
                <StaticScreen name={ screen } />
            ) : (
                <SpaceGate>
                    <App />
                </SpaceGate>
            ) }
        </ThemeProvider>
    );
}
