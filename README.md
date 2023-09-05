# n9-mongodb-client

[![npm version](https://img.shields.io/npm/v/@neo9/n9-mongodb-client.svg)](https://www.npmjs.com/package/@neo9/n9-mongodb-client)
[![Build Status](https://img.shields.io/endpoint.svg?url=https%3A%2F%2Factions-badge.atrox.dev%2Fneo9%2Fn9-mongodb-client%2Fbadge&style=flat)](https://actions-badge.atrox.dev/neo9/n9-mongodb-client/goto)
[![Coverage](https://img.shields.io/codecov/c/github/neo9/n9-mongodb-client/master.svg)](https://codecov.io/gh/neo9/n9-mongodb-client)

A client to use easily MongoDB official driver.

## Upgrade to V1 (from v 0.33)

### First, upgrade to V 1.0.0-rc.0

Breaking changes (due to [mongodb driver](https://github.com/mongodb/node-mongodb-native) upgrade) :

- Index creation/update/deletion now use parameter of type `IndexSpecification`
- Sort param is no more an `object`, it is a proper type `Sort`
- `global.dbClient.isConnected` should now be replaced by `MongoUtils.isConnected`

Notable Changes

- Name changed from `@neo9/n9-mongo-client` to `@neo9/n9-mongodb-client`
- `Cursor` are now `N9FindCursor` or `N9AggregationCursor`

Upgrade main steps

- `yarn remove @neo9/n9-mongo-client && yarn add @neo9/n9-mongodb-client@^1.0.0-rc.2` (this also upgrade all transitive dependencies)
- Rename usage : `find src/ -type f -exec sed -i -e 's#@neo9/n9-mongo-client#@neo9/n9-mongodb-client#g' {} +`
- Remove old mongodb types :

  - `yarn remove @types/mongodb`
  - `find src/ -type f -exec sed -i -e "s#from 'mongodb'# from '@neo9/n9-mongodb-client/mongodb'#g" {} +`
  - :warning: `find src/ -type f -exec sed -i -e "s#AggregationCursor<#N9AggregationCursor<#g" {} +` Can fix most of cases
  - :warning: `find src/ -type f -exec sed -i -e "s#Cursor<#N9FindCursor<#g" {} +` Can fix most of cases

- Upgrade dependencies required : `yarn upgrade typescript @neo9/n9-coding-style prettier --latest`
  - Upgrade tsconfig for node 16+ :
    - `yarn add -D @tsconfig/node16`
    - `yarn remove @tsconfig/node14`
    - Upgrade `tsconfig.json` file
      - `sed -i 's#node14#node16#g' tsconfig.json`
- Upgrade MongoDb used for tests to version 6.0+
- Change MongoDB types imports from `import ... from 'mongodb';` to `import ... from '@neo9/n9-mongodb-client/mongodb';`

## To build

Use node 16.20.2+ to build and yarn.

```bash
git clone https://github.com/neo9/n9-mongodb-client.git
cd n9-mongodb-client
yarn && yarn build
```

## Sample of usages

Please refer to [test folder](./test) to find samples.
