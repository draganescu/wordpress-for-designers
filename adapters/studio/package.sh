#!/bin/sh
# Packages the adapter as dist/wfd-studio.zip in this folder. The zip holds
# one folder, wfd-studio/, with the three files of plugin/ and nothing else.
# It is never part of the main plugin's package.
set -eu

cd "$(dirname "$0")"

SLUG=wfd-studio
EXPECTED="pick-layer.js readme.txt wfd-studio.php"

ACTUAL=$(ls -A plugin | sort | tr '\n' ' ' | sed 's/ $//')
if [ "$ACTUAL" != "$EXPECTED" ]; then
    echo "plugin/ must hold exactly: $EXPECTED. It holds: $ACTUAL" >&2
    exit 1
fi

rm -rf dist
mkdir -p "dist/$SLUG"
cp plugin/wfd-studio.php plugin/pick-layer.js plugin/readme.txt "dist/$SLUG/"

( cd dist && zip -q -r -X "$SLUG.zip" "$SLUG" )
rm -rf "dist/$SLUG"

ZIPPED=$(unzip -Z1 "dist/$SLUG.zip" | grep -v '/$' | sort | tr '\n' ' ' | sed 's/ $//')
if [ "$ZIPPED" != "$SLUG/pick-layer.js $SLUG/readme.txt $SLUG/wfd-studio.php" ]; then
    echo "Unexpected contents in dist/$SLUG.zip: $ZIPPED" >&2
    exit 1
fi

echo "dist/$SLUG.zip"
