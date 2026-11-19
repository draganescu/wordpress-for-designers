#!/bin/zsh
# Usage: all.sh <browser> — runs every mode at every zoom, 3 at a time.
cd "$(dirname "$0")"
B=${1:-chromium}
mkdir -p logs
jobs_list=()
for z in 0.5 0.3 0.75; do
  for m in B A-iframe-zoom C-html-transform A-html-zoom naive A-surface-zoom A-frame-zoom; do
    jobs_list+=("$m $z")
  done
  for m in B A-iframe-zoom C-html-transform; do jobs_list+=("$m $z fix"); done
done
for m in B A-iframe-zoom C-html-transform A-html-zoom; do jobs_list+=("$m 1"); done
printf '%s\n' "${jobs_list[@]}" | xargs -P 2 -L 1 sh -c 'node run.mjs '$B' $0 $1 $2 > logs/'$B'__$0__$1__$2.log 2>&1'
echo done
