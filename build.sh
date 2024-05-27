#!/bin/bash

set -ex

pushd runtime
npx rollup -c rollup.config.mjs
popd

xcaddy build --with github.com/devsnek/caddy-js=.
