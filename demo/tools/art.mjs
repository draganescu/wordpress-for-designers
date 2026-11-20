/**
 * Renders the generated artwork of the demo site (coffee bags, the hero
 * line-up, the brand mark and two brand graphics) with Chromium and writes
 * JPEG and PNG files to demo/plugin/wfd-demo/media/.
 *
 * Run from the repository root: node demo/tools/art.mjs
 */
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname( fileURLToPath( import.meta.url ) );
const fonts = join( here, '../theme/morrow/assets/fonts' );
const out = join( here, '../plugin/wfd-demo/media' );
mkdirSync( out, { recursive: true } );

const font = ( file ) =>
    `data:font/woff2;base64,${ readFileSync( join( fonts, file ) ).toString(
        'base64'
    ) }`;

export const coffees = [
    {
        slug: 'daybreak',
        name: 'Daybreak',
        origin: 'Ethiopia · Guji',
        process: 'Washed',
        notes: [ 'Bergamot', 'Peach', 'Jasmine' ],
        bag: '#F4EFE6',
        ink: '#1B1714',
        ground: '#F2A541',
        sun: '#E4572E',
    },
    {
        slug: 'slow-river',
        name: 'Slow River',
        origin: 'Colombia · Huila',
        process: 'Washed',
        notes: [ 'Caramel', 'Red apple', 'Cocoa' ],
        bag: '#2F4A3A',
        ink: '#F4EFE6',
        ground: '#C9D8B6',
        sun: '#F2C14E',
    },
    {
        slug: 'night-shift',
        name: 'Night Shift',
        origin: 'Espresso blend',
        process: 'Brazil + Guatemala',
        notes: [ 'Dark chocolate', 'Hazelnut', 'Molasses' ],
        bag: '#1B1714',
        ink: '#F4EFE6',
        ground: '#E4572E',
        sun: '#F2C14E',
    },
    {
        slug: 'paper-kite',
        name: 'Paper Kite',
        origin: 'Kenya · Nyeri',
        process: 'Washed',
        notes: [ 'Blackcurrant', 'Grapefruit', 'Brown sugar' ],
        bag: '#2743C4',
        ink: '#F4EFE6',
        ground: '#F4D9D0',
        sun: '#E4572E',
    },
    {
        slug: 'soft-landing',
        name: 'Soft Landing',
        origin: 'Mexico · Chiapas',
        process: 'Decaf · Mountain water',
        notes: [ 'Milk chocolate', 'Almond', 'Honey' ],
        bag: '#D9C7F0',
        ink: '#1B1714',
        ground: '#F4EFE6',
        sun: '#2F4A3A',
    },
    {
        slug: 'first-frost',
        name: 'First Frost',
        origin: 'Winter blend',
        process: 'Limited · Until February',
        notes: [ 'Spiced plum', 'Cocoa', 'Orange peel' ],
        bag: '#DCE9F2',
        ink: '#14233A',
        ground: '#14233A',
        sun: '#8FB8DE',
    },
];

const css = `
@font-face { font-family: Manrope; src: url(${ font(
    'Manrope-VariableFont_wght.woff2'
) }) format('woff2'); font-weight: 200 800; }
@font-face { font-family: Fira; src: url(${ font(
    'FiraCode-VariableFont_wght.woff2'
) }) format('woff2'); font-weight: 300 700; }
* { box-sizing: border-box; margin: 0; }
body { font-family: Manrope, sans-serif; }
.scene { position: relative; overflow: hidden; display: flex; align-items: center; justify-content: center; }
.sun { position: absolute; border-radius: 50%; }
.bag { position: relative; width: 660px; height: 960px; border-radius: 14px 14px 26px 26px; padding: 150px 56px 56px; display: flex; flex-direction: column; box-shadow: 0 60px 80px -30px rgba(0,0,0,.45), 0 10px 20px rgba(0,0,0,.12); }
.bag::before { content: ''; position: absolute; inset: 0; border-radius: inherit; background: linear-gradient(90deg, rgba(0,0,0,.20), rgba(0,0,0,0) 14%, rgba(255,255,255,.10) 38%, rgba(0,0,0,0) 62%, rgba(0,0,0,.24)); pointer-events: none; }
.crimp { position: absolute; left: 0; right: 0; top: 0; height: 84px; border-radius: 14px 14px 0 0; background: repeating-linear-gradient(90deg, rgba(0,0,0,.14) 0 3px, rgba(0,0,0,0) 3px 12px); border-bottom: 2px solid rgba(0,0,0,.18); }
.tie { position: absolute; left: 50%; top: 108px; width: 120px; height: 10px; margin-left: -60px; border-radius: 6px; background: currentColor; opacity: .25; }
.brand { font-family: Fira, monospace; font-size: 19px; letter-spacing: .22em; text-transform: uppercase; display: flex; justify-content: space-between; }
.mark { width: 150px; height: 75px; margin: 70px 0 34px; overflow: hidden; position: relative; }
.mark i { position: absolute; left: 0; top: 0; width: 150px; height: 150px; border-radius: 50%; }
.mark b { position: absolute; left: 0; right: 0; bottom: 0; height: 6px; background: currentColor; }
.name { font-size: 118px; line-height: .92; font-weight: 800; letter-spacing: -.045em; }
.origin { margin-top: 26px; font-size: 30px; font-weight: 500; letter-spacing: -.01em; }
.process { font-size: 22px; opacity: .7; margin-top: 6px; }
.notes { margin-top: auto; border-top: 2px solid currentColor; padding-top: 22px; font-family: Fira, monospace; font-size: 19px; letter-spacing: .08em; text-transform: uppercase; line-height: 1.7; }
.foot { margin-top: 26px; display: flex; justify-content: space-between; font-family: Fira, monospace; font-size: 17px; letter-spacing: .16em; text-transform: uppercase; opacity: .75; }
.floor { position: absolute; width: 620px; height: 60px; border-radius: 50%; background: rgba(0,0,0,.28); filter: blur(26px); }
`;

function bag( c, scale = 1, rotate = 0 ) {
    return `
    <div class="bag" style="background:${ c.bag };color:${
        c.ink
    };transform:scale(${ scale }) rotate(${ rotate }deg)">
        <div class="crimp"></div><div class="tie"></div>
        <div class="brand"><span>Morrow</span><span>Coffee roasters</span></div>
        <div class="mark"><i style="background:${ c.sun }"></i><b></b></div>
        <div class="name">${ c.name.replace( ' ', '<br>' ) }</div>
        <div class="origin">${ c.origin }</div>
        <div class="process">${ c.process }</div>
        <div class="notes">${ c.notes.join( '<br>' ) }</div>
        <div class="foot"><span>250 g</span><span>Whole bean</span></div>
    </div>`;
}

const scenes = [];

for ( const c of coffees ) {
    scenes.push( {
        file: `bag-${ c.slug }.jpg`,
        width: 1600,
        height: 1600,
        html: `<div class="scene" style="width:1600px;height:1600px;background:${
            c.ground
        }">
            <div class="sun" style="width:1250px;height:1250px;background:${
                c.sun
            };opacity:.9;top:420px"></div>
            <div class="floor" style="bottom:240px"></div>
            ${ bag( c, 1.12 ) }
        </div>`,
    } );
}

const pick = ( slug ) => coffees.find( ( c ) => c.slug === slug );

scenes.push( {
    file: 'hero-lineup.jpg',
    width: 2400,
    height: 1500,
    html: `<div class="scene" style="width:2400px;height:1500px;background:#F2C14E">
        <div class="sun" style="width:2100px;height:2100px;background:#E4572E;top:520px"></div>
        <div style="display:flex;gap:40px;align-items:flex-end;margin-top:120px">
            ${ bag( pick( 'slow-river' ), 0.96, -5 ) }
            ${ bag( pick( 'daybreak' ), 1.1, 0 ) }
            ${ bag( pick( 'night-shift' ), 0.96, 5 ) }
        </div>
    </div>`,
} );

scenes.push( {
    file: 'winter-lineup.jpg',
    width: 2400,
    height: 1500,
    html: `<div class="scene" style="width:2400px;height:1500px;background:#14233A">
        <div class="sun" style="width:1700px;height:1700px;background:#8FB8DE;top:640px;opacity:.9"></div>
        <div class="sun" style="width:1100px;height:1100px;background:#DCE9F2;top:940px"></div>
        <div style="margin-top:80px">${ bag(
            pick( 'first-frost' ),
            1.12,
            -4
        ) }</div>
    </div>`,
} );

scenes.push( {
    file: 'sunrise-arcs.jpg',
    width: 2400,
    height: 1400,
    html: `<div class="scene" style="width:2400px;height:1400px;background:#1B1714">
        ${ [ '#2F4A3A', '#E4572E', '#F2A541', '#F2C14E', '#F4EFE6' ]
            .map(
                ( color, i ) =>
                    `<div class="sun" style="width:${
                        2600 - i * 480
                    }px;height:${
                        2600 - i * 480
                    }px;background:${ color };top:${ 380 + i * 240 }px"></div>`
            )
            .join( '' ) }
    </div>`,
} );

scenes.push( {
    file: 'tasting-wheel.jpg',
    width: 1600,
    height: 1600,
    html: `<div class="scene" style="width:1600px;height:1600px;background:#F4EFE6">
        <div style="width:1200px;height:1200px;border-radius:50%;background:conic-gradient(#E4572E 0 60deg,#F2A541 0 120deg,#F2C14E 0 180deg,#2F4A3A 0 240deg,#2743C4 0 300deg,#D9C7F0 0)"></div>
        <div class="sun" style="width:520px;height:520px;background:#F4EFE6"></div>
        <div style="position:absolute;font-family:Fira,monospace;font-size:34px;letter-spacing:.2em;text-transform:uppercase;color:#1B1714;text-align:center;line-height:1.6">Taste<br>first</div>
    </div>`,
} );

scenes.push( {
    file: 'morrow-mark.png',
    width: 512,
    height: 512,
    transparent: true,
    html: `<div class="scene" style="width:512px;height:512px">
        <div style="width:400px;height:200px;overflow:hidden;position:relative;margin-top:-40px">
            <div style="position:absolute;left:0;top:0;width:400px;height:400px;border-radius:50%;background:#E4572E"></div>
        </div>
        <div style="position:absolute;left:36px;right:36px;top:320px;height:28px;background:#1B1714"></div>
    </div>`,
} );

const browser = await chromium.launch();
for ( const scene of scenes ) {
    const page = await browser.newPage( {
        viewport: { width: scene.width, height: scene.height },
    } );
    await page.setContent(
        `<style>${ css }</style><body style="background:${
            scene.transparent ? 'transparent' : '#fff'
        }">${ scene.html }</body>`
    );
    await page.evaluate( () => document.fonts.ready );
    await page.screenshot( {
        path: join( out, scene.file ),
        type: scene.file.endsWith( '.png' ) ? 'png' : 'jpeg',
        ...( scene.file.endsWith( '.png' )
            ? { omitBackground: true }
            : { quality: 88 } ),
    } );
    await page.close();
    process.stdout.write( `${ scene.file }\n` );
}
await browser.close();
