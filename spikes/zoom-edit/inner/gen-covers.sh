#!/bin/zsh
# Builds covers.mjs = setup part of run.mjs + covers-body.mjs
cd "$(dirname "$0")"
awk '/^\/\/ 2\. hit-testing and typing/{exit} {print}' run.mjs | sed 's/^let bw = await position.*$/let bw = null;/' | grep -v "out.layout.titleScreen" > covers.mjs
cat covers-body.mjs >> covers.mjs
