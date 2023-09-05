# n9-mongo-client

[![npm version](https://img.shields.io/npm/v/@neo9/n9-mongo-client.svg)](https://www.npmjs.com/package/@neo9/n9-mongo-client)
[![Travis](https://app.travis-ci.com/neo9/n9-mongo-client.svg?branch=master)](https://app.travis-ci.com/github/neo9/n9-mongo-client)
[![Coverage](https://img.shields.io/codecov/c/github/neo9/n9-mongo-client/master.svg)](https://codecov.io/gh/neo9/n9-mongo-client)

A client to use easily MongoDB official driver.

## Upgrade to V1 (from v 0.33)

### First, upgrade to V 1.0.0-rc.0

Breaking changes (due to [mongodb driver](https://github.com/mongodb/node-mongodb-native) upgrade) :

- Index creation/update/deletion now use parameter of type `IndexSpecification`
- Sort param is no more an `object`, it is a proper type `Sort`
- `global.dbClient.isConnected` should now be replaced by `MongoUtils.isConnected`

Notable Changes

- `Cursor` are now `N9FindCursor` or `N9AggregationCursor`

Upgrade main steps

- `yarn remove @neo9/n9-mongo-client && yarn add @neo9/n9-mongo-client@^1.0.0-rc.0` Upgrade all transitive dependencies
- `yarn remove @types/mongodb`
- `yarn upgrade typescript @neo9/n9-coding-style prettier --latest`
  - Upgrade tsconfig for node 16+ :
    - `yarn add -D @tsconfig/node16`
    - Upgrade `tsconfig.json` file
- Upgrade MongoDb used for tests to version 6.0+
- Change MongoDB types imports from `import ... from 'mongodb';` to `import ... from '@neo9/n9-mongo-client/mongodb';`

## To build

Use node 16.20.2+ to build and yarn.

```bash
git clone https://github.com/neo9/n9-mongo-client.git
cd n9-mongo-client
yarn && yarn build
```

## Sample of usages

Please refer to [test folder](./test) to find samples.
