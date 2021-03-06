#!/bin/bash -u
# We use set -e and bash with -u to bail on first non zero exit code of any
# processes launched or upon any unbound variable.
# We use set -x to print commands before running them to help with
# debugging.
set -ex

SKIP_YARN=${SKIP_YARN:-false}
if [[ ${SKIP_YARN} = 'true' ]]
then
  echo 'skipping yarn'
else
  yarn
fi

# This is just a small module, and it's a pain to try and load it dynamically
# so compile this manually and require via package.json#main === build/
yarn tsc -b "../webexts-build-utils/tsconfig.build.json"

BUILD_TS=${BUILD_TS:-true}
TS_LOADER_TRANSPILE_ONLY=${TS_LOADER_TRANSPILE_ONLY:-false}

if [[ ${BUILD_TS} = 'false' ]] || [[ ${TS_LOADER_TRANSPILE_ONLY} = 'true' ]]
then
  echo 'skipping build typescript step'
else
  time yarn build:ts:verbose
fi

BROWSER_NAME=${2:-chrome}
BUILD_ENV=${1:-prod}
EXTRA_ARGS=${@:3}

if [[ ${BROWSER_NAME} = "firefox" ]]
then
  BROWSER_API=chrome
elif [[ ${BROWSER_NAME} = "chrome" ]]
then
  BROWSER_API=chrome
elif [[ ${BROWSER_NAME} = "edge" ]]
then
  BROWSER_API=chrome
else
  BROWSER_API=chrome
fi

if [[ ${BUILD_ENV} = "dev" ]]
then
  WEBPACK=webpack.dev.ts
elif [[ ${BUILD_ENV} = "staging" ]]
then
  WEBPACK=webpack.staging.ts
elif [[ ${BUILD_ENV} = "prod" ]]
then
  WEBPACK=webpack.prod.ts
else
  WEBPACK=webpack.prod.ts
fi

echo Running ${BUILD_ENV} build for ${BROWSER_NAME}...
BROWSER=${BROWSER_NAME} API=${BROWSER_API} yarn webpack-cli --reporter basic --config ${WEBPACK} ${EXTRA_ARGS}
