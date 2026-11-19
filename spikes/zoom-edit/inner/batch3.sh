#!/bin/zsh
# Firefox and WebKit for the two viable candidates (+ zoom-on-surface re-test), and Chromium above 100%.
cd "$(dirname "$0")"
{
for b in firefox webkit; do
  for z in 0.5 0.3 0.75; do
    for m in B A-iframe-zoom; do echo "run.mjs $b $m $z fix"; echo "run.mjs $b $m $z"; done
    echo "run.mjs $b A-surface-zoom $z"
  done
  echo "covers.mjs $b B 0.5 fix"; echo "covers.mjs $b A-iframe-zoom 0.5 fix"
done
} | xargs -P 2 -L 1 sh -c 'node $0 $1 $2 $3 $4 > logs/$0__$1__$2__$3__$4.log 2>&1'
for z in 1.5 2; do for m in B A-iframe-zoom; do ZS_VW=2400 node run.mjs chromium $m $z fix > logs/run.mjs__chromium__${m}__${z}__fix.log 2>&1; done; done
echo done
