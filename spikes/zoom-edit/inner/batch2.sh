#!/bin/zsh
cd "$(dirname "$0")"
{
for z in 0.3 0.5 0.75; do echo "run.mjs chromium A-artboard-zoom $z"; done
for z in 0.3 0.5 0.75; do for m in B A-iframe-zoom; do echo "covers.mjs chromium $m $z"; echo "covers.mjs chromium $m $z fix"; done; done
} | xargs -P 2 -L 1 sh -c 'node $0 $1 $2 $3 $4 > logs/$0__$1__$2__$3__$4.log 2>&1'
echo done
