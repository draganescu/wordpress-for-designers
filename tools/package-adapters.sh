#!/bin/sh
# Packages every adapter under adapters/ and copies its zip into dist/, next
# to the main plugin's zip, so a release attaches them all.
#
# Each adapter has its own package.sh, which leaves exactly one zip in its
# own dist/ folder. An adapter is never part of the main plugin's zip
# (tools/package.sh). A line with no adapters/ folder packages nothing.
#
# Run `npm run package` first: it empties dist/.
set -eu

cd "$(dirname "$0")/.."

mkdir -p dist

for SCRIPT in adapters/*/package.sh; do
    [ -f "$SCRIPT" ] || continue
    DIR=$(dirname "$SCRIPT")

    sh "$SCRIPT" > /dev/null

    COUNT=$(find "$DIR/dist" -maxdepth 1 -name '*.zip' | wc -l | tr -d ' ')
    if [ "$COUNT" != 1 ]; then
        echo "$SCRIPT left $COUNT zips in $DIR/dist; expected 1." >&2
        exit 1
    fi

    ZIP=$(find "$DIR/dist" -maxdepth 1 -name '*.zip')
    NAME=$(basename "$ZIP")
    if [ -e "dist/$NAME" ]; then
        echo "Two packages are named $NAME." >&2
        exit 1
    fi

    cp "$ZIP" "dist/$NAME"
    echo "dist/$NAME"
done
