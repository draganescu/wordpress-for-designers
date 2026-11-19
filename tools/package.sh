#!/bin/sh
# Assembles the installable plugin in dist/wordpress-for-designers and zips it
# to dist/wordpress-for-designers.zip. The zip holds one folder,
# wordpress-for-designers/, which is what WordPress expects on upload.
#
# Run `npm run build` first. Both the release and the playground workflows use
# this list of files, so a new top-level file of the plugin is added here only.
set -eu

cd "$(dirname "$0")/.."

SLUG=wordpress-for-designers

if [ ! -f build/board.asset.php ]; then
    echo "build/ is missing or incomplete. Run npm run build first." >&2
    exit 1
fi

rm -rf dist
mkdir -p "dist/$SLUG"
cp -R wordpress-for-designers.php uninstall.php includes build "dist/$SLUG/"
find dist -name .DS_Store -delete

( cd dist && zip -q -r -X "$SLUG.zip" "$SLUG" )

echo "dist/$SLUG.zip"
