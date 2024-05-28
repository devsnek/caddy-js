#!/bin/bash

set -ex

pushd runtime
npx rollup -c rollup.config.mjs
popd

xcaddy build \
  --with github.com/devsnek/caddy-js=. \
  --with github.com/dop251/goja=github.com/devsnek/goja@4cc620e4bdbf20983e8d36ffe7433c2acf9216f6
