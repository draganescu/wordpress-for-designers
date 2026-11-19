# WordPress for Designers

A WordPress plugin that opens an infinite canvas (a board) inside WordPress. Each artboard on the board shows one page, template, template part or pattern of the site, rendered with real blocks. One artboard at a time can be edited with a block editor, and global styles are edited from the same screen and repaint every artboard.

## Try it

[**Test in WordPress Playground**](https://playground.wordpress.net/?blueprint-url=https://raw.githubusercontent.com/draganescu/wordpress-for-designers/master/blueprint.json)

The link starts a WordPress 7.2 site in your browser with the latest build of `master` installed and opens the Boards screen. Nothing is installed on your computer, and the site is discarded when you close the tab.

## Requirements

- WordPress 7.2 or later
- PHP 7.4 or later
- A block theme

## Develop

```bash
npm ci
npm run build
npm run wp-env start
```

The site runs at http://localhost:8888. End-to-end tests run with `npm run test:e2e`.

## Documentation

- [docs/state.md](docs/state.md): what exists now and how to run it
- [docs/working-notes.md](docs/working-notes.md): how the work was done
- [spec/](spec/): the specification the plugin is built from

## License

GPL-2.0-or-later
