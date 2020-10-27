## [0.16.2](https://github.com/neo9/n9-mongo-client/compare/0.16.1...0.16.2) (2020-10-27)


### perf

* Improve update many at once perf with query callback ([c69d0de](https://github.com/neo9/n9-mongo-client/commit/c69d0de9438e62ec3e3bee834388b6e041fee346))
* Improve update many at once perf with query string ([084edec](https://github.com/neo9/n9-mongo-client/commit/084edecfa2d29be83d0bca9e2513bdbcf56f23b9))

### yarn

* Fix repository used for mingo ([e864cba](https://github.com/neo9/n9-mongo-client/commit/e864cba356ddfebf0c30fa3c4bc9106950cdf028))

## [0.16.1](https://github.com/neo9/n9-mongo-client/compare/0.16.0...0.16.1) (2020-10-09)


### yarn

* Upgrade n9-node-utils to V 2.0.1 ([b09a19f](https://github.com/neo9/n9-mongo-client/commit/b09a19f6f9875e4665148cf1519e674225c5da60))

# [0.16.0](https://github.com/neo9/n9-mongo-client/compare/0.15.3...0.16.0) (2020-10-09)


### errors

* Wrap errors to n9 errors ([e5e5dcb](https://github.com/neo9/n9-mongo-client/commit/e5e5dcb62ab059c269c93c561be9ca15c32a0ce1))

### yarn

* Upgrade n9-node-utils to V 2.0.0 ([ba50498](https://github.com/neo9/n9-mongo-client/commit/ba504987ce022136d7e68feedcaa85a4ac148533))

## [0.15.3](https://github.com/neo9/n9-mongo-client/compare/0.15.2...0.15.3) (2020-10-07)


### security

* Prevent user from setting the _id of an entity ([26b8bb2](https://github.com/neo9/n9-mongo-client/commit/26b8bb2327b42194a38ec00d4d6b7bc2ad78c764))

## [0.15.2](https://github.com/neo9/n9-mongo-client/compare/0.15.1...0.15.2) (2020-10-06)


### format

* Fix formatting ([6898893](https://github.com/neo9/n9-mongo-client/commit/689889370c289d1ab4456e9297be93e5f3395a63))

### security

* Prevent user from setting the _id of an entity ([29c887f](https://github.com/neo9/n9-mongo-client/commit/29c887f66e612d68f3628875fc85049b742d40e8))

### types

* Fix typing and add some tests ([e532a09](https://github.com/neo9/n9-mongo-client/commit/e532a092e3a044d8565d1bae8fbbc96108f3fa14))

## [0.15.1](https://github.com/neo9/n9-mongo-client/compare/0.15.0...0.15.1) (2020-09-23)


### yarn

* Upgrade all dependencies except class-transformer ([f91c2f1](https://github.com/neo9/n9-mongo-client/commit/f91c2f16df78c052e22a5193c0dd8b4818173f99))

# [0.15.0](https://github.com/neo9/n9-mongo-client/compare/0.15.0-rc.0...0.15.0) (2020-09-22)


### perf

* Fix new Date location ([66df1be](https://github.com/neo9/n9-mongo-client/commit/66df1be7d57a12ef9df7bb34f4aab9c4729becd4))

# [0.15.0-rc.0](https://github.com/neo9/n9-mongo-client/compare/0.14.4...0.15.0-rc.0) (2020-09-22)


### benchmark

* Add benchmark on insert and read ([cbd7051](https://github.com/neo9/n9-mongo-client/commit/cbd70510db5215fcce5b26f8bc2e889d384bb933))

### perf

* Improve performance by reducing lodash usage ([0036cbd](https://github.com/neo9/n9-mongo-client/commit/0036cbdb168b8ea78ff31b874560106c3d848478))

### update

* Update last modification date on update many to same value ([382cb9f](https://github.com/neo9/n9-mongo-client/commit/382cb9f659f47df111b4d2de0318836954fc4fd8))

### yarn

* Fix npm registry ([228f1b0](https://github.com/neo9/n9-mongo-client/commit/228f1b050ec618e6e9cf40c51e17acf35261aff6))

## [0.14.4](https://github.com/neo9/n9-mongo-client/compare/0.14.3...0.14.4) (2020-09-15)


### format

* Fix format ([b03262b](https://github.com/neo9/n9-mongo-client/commit/b03262beb1acdcbae84cfa4ef6347261c429bd27))

### locks

* Fix lockFields clean if nothing to clean ([b691684](https://github.com/neo9/n9-mongo-client/commit/b691684911c6d52772bc13b6953b7be61791353d))

## [0.14.3](https://github.com/neo9/n9-mongo-client/compare/0.14.2...0.14.3) (2020-09-14)


### locks

* Fix array deletion when it is locked ([e63aef7](https://github.com/neo9/n9-mongo-client/commit/e63aef73cd134c15faf8e47d86b7e3c8b8d71729))

### yarn

* Update dependencies for security fix ([494ae98](https://github.com/neo9/n9-mongo-client/commit/494ae989083b2fe73aea26801346f464252bc276))

## [0.14.2](https://github.com/neo9/n9-mongo-client/compare/0.14.2-rc.0...0.14.2) (2020-08-25)

## [0.14.2-rc.0](https://github.com/neo9/n9-mongo-client/compare/1.14.2-rc.0...0.14.2-rc.0) (2020-08-25)

## [1.14.2-rc.0](https://github.com/neo9/n9-mongo-client/compare/0.14.1...1.14.2-rc.0) (2020-08-25)


### insert

* Fix insertion of null values with lock fields enabled ([bb03542](https://github.com/neo9/n9-mongo-client/commit/bb035422786bf8f6179d134b51209ccb1aa29488))

## [0.14.1](https://github.com/neo9/n9-mongo-client/compare/0.14.0...0.14.1) (2020-07-28)


### date

* Fix date deletion during object cleaning ([9558f61](https://github.com/neo9/n9-mongo-client/commit/9558f610fbab359acfadd980b2747cddd3776e9f))

# [0.14.0](https://github.com/neo9/n9-mongo-client/compare/0.14.0-rc.5...0.14.0) (2020-07-24)

# [0.14.0-rc.5](https://github.com/neo9/n9-mongo-client/compare/0.4.0-rc.5...0.14.0-rc.5) (2020-07-24)

# [0.4.0-rc.5](https://github.com/neo9/n9-mongo-client/compare/0.14.0-rc.4...0.4.0-rc.5) (2020-07-24)


### update

* Fix modification date on upsert operations ([e4b21d6](https://github.com/neo9/n9-mongo-client/commit/e4b21d689c2835a87615c3e29a1e0b8fbb689441))

# [0.14.0-rc.4](https://github.com/neo9/n9-mongo-client/compare/0.14.0-rc.3...0.14.0-rc.4) (2020-07-22)


### tests

* Fix too quick operation ([5dad8c7](https://github.com/neo9/n9-mongo-client/commit/5dad8c734f73ac383dc3909df8f82c64d6d83ead))

# [0.14.0-rc.3](https://github.com/neo9/n9-mongo-client/compare/0.14.0-rc.2...0.14.0-rc.3) (2020-07-22)


### update

* Fix modification date on bulk operations ([a17af2d](https://github.com/neo9/n9-mongo-client/commit/a17af2d4ac7c6236288b5384581c7a7bda71f138))

# [0.14.0-rc.2](https://github.com/neo9/n9-mongo-client/compare/0.14.0-rc.1...0.14.0-rc.2) (2020-07-21)


### update

* Fix modification date update with sub object modification ([8255ce0](https://github.com/neo9/n9-mongo-client/commit/8255ce0e991f81baa2a2f5ac88d98891d596d4c0))

# [0.14.0-rc.1](https://github.com/neo9/n9-mongo-client/compare/0.14.0-rc.0...0.14.0-rc.1) (2020-07-21)


### format

* Fix formatting ([164b0a9](https://github.com/neo9/n9-mongo-client/commit/164b0a967a9e5f9e6ec5f6111fc8e65498682ebe))

### tests

* Fix tests for update only on change ([8bd3f3d](https://github.com/neo9/n9-mongo-client/commit/8bd3f3d035858573d6cc2a09f0a17e867da7d336))

### yarn

* Upgrade mongodb drivers and lodash types ([00164d5](https://github.com/neo9/n9-mongo-client/commit/00164d50379e2fb7dc1ec803aa1149770b97f385))

# [0.14.0-rc.0](https://github.com/neo9/n9-mongo-client/compare/0.13.3...0.14.0-rc.0) (2020-07-20)


### ci

* Fix codecov regression ([bbaf134](https://github.com/neo9/n9-mongo-client/commit/bbaf1348ea2c7cd8e08019f868722a1584f185af))
* Remove pre-push hooks and update readme ([809de97](https://github.com/neo9/n9-mongo-client/commit/809de97be7bba69001ab6dca7478e698df1ce239))
* Update travis configuration ([2384982](https://github.com/neo9/n9-mongo-client/commit/23849827425614c78d3a3b429733d1bb042667b3))

### client

* Add support for updateOnlyOnChange in findOneAndUpdate ([5cafe80](https://github.com/neo9/n9-mongo-client/commit/5cafe80362be7cedc1d7082816fa8478297d7db7))
* Move client configuration model in separate file ([ba274f6](https://github.com/neo9/n9-mongo-client/commit/ba274f68189ddf000396bc05c255c69cc989af8a))
* Move tag feature in a seperate class ([4728eae](https://github.com/neo9/n9-mongo-client/commit/4728eae5ec58b1f9b6b06838bd05856a798c39e1))
* Split index management and historic in seperate classes ([8dd6c01](https://github.com/neo9/n9-mongo-client/commit/8dd6c01bed14430cebd9e6b3b790600878c5a2ca))
* Use UpdateQuery type instead of custom type ([ef693f5](https://github.com/neo9/n9-mongo-client/commit/ef693f58b427411efb9fdd6d6583fb2f58e387f6))

### locks

* Set lock options optional ([088d218](https://github.com/neo9/n9-mongo-client/commit/088d218a103370ba02c9b3a781975bbee5ca418c))

### release

* Fix release it tag name ([a7aa33b](https://github.com/neo9/n9-mongo-client/commit/a7aa33bcd520bd403222b7edd9bcf55c46c8cc78))

### yarn

* Add codecov dev dependency ([3eba43d](https://github.com/neo9/n9-mongo-client/commit/3eba43d64eb038a2c99f2c1bf6a2734913ff6089))
* Upgrade lodash to v 4.17.19 and minimist ([d766e78](https://github.com/neo9/n9-mongo-client/commit/d766e781920a8f00a77bdc84dbb5fdd812982c24))
* Upgrade mongodb driver to v 3.5.9 ([0e9a3e3](https://github.com/neo9/n9-mongo-client/commit/0e9a3e389c021551a419d051ca030b21bbf355d8))

## [0.13.3](https://github.com/neo9/n9-mongo-client/compare/0.13.2...%s) (2020-06-15)


### locks

* Fix lock duration check to acquire lock ([a3119a8](https://github.com/neo9/n9-mongo-client/commit/a3119a81015bc072a59b843f441667ea6577cc99))

### yarn

* Upgrade release-it ava and mongodb-memory-server ([5d534fb](https://github.com/neo9/n9-mongo-client/commit/5d534fb796dce00593e15b13d0eab98898529cda))

## Version [0.13.2](https://github.com/neo9/n9-mongo-client/compare/0.13.1...0.13.2) (2020-03-03)


### format

* Format before commit ([7174244](https://github.com/neo9/n9-mongo-client/commit/7174244)) (Benjamin Daniel)

### lint

* Use neo9 coding style and prettier ([bc8710c](https://github.com/neo9/n9-mongo-client/commit/bc8710c)) (Benjamin Daniel)



## Version [0.13.1](https://github.com/neo9/n9-mongo-client/compare/0.13.0...0.13.1) (2020-02-28)


### locks

* Fix locks expiring ([eef34f8](https://github.com/neo9/n9-mongo-client/commit/eef34f8)) (Benjamin Daniel)

### release

* V 0.13.1 ([198a9b1](https://github.com/neo9/n9-mongo-client/commit/198a9b1)) (Benjamin Daniel)



# Version [0.13.0](https://github.com/neo9/n9-mongo-client/compare/0.12.6...0.13.0) (2020-02-25)


### client

* Add tag / untag feature ([70a4844](https://github.com/neo9/n9-mongo-client/commit/70a4844)) (Clement Petit)

### cursor

* Fix unit test ([8c5618a](https://github.com/neo9/n9-mongo-client/commit/8c5618a)) (Clement Petit)

### lock

* Forward constructor options to mongoDbLock ([7894c79](https://github.com/neo9/n9-mongo-client/commit/7894c79)) (Clement Petit)

### release

* V 0.13.0 ([b6d1f71](https://github.com/neo9/n9-mongo-client/commit/b6d1f71)) (Benjamin Daniel)

### tests

* Add tests on lastUpdate date ([15dbae5](https://github.com/neo9/n9-mongo-client/commit/15dbae5)) (Benjamin Daniel)



## Version [0.12.6](https://github.com/neo9/n9-mongo-client/compare/0.12.5...0.12.6) (2020-02-13)


### mongo

* Revert mongodb driver version to 3.2.5 NODE-2454 ([e403b42](https://github.com/neo9/n9-mongo-client/commit/e403b42)) (Clement Petit)

### release

* V 0.12.6 ([3d22504](https://github.com/neo9/n9-mongo-client/commit/3d22504)) (Clement Petit)



## Version [0.12.5](https://github.com/neo9/n9-mongo-client/compare/0.12.4...0.12.5) (2020-02-07)


### release

* V 0.12.5 ([88201c3](https://github.com/neo9/n9-mongo-client/commit/88201c3)) (Clement Petit)



## Version [0.12.4](https://github.com/neo9/n9-mongo-client/compare/0.12.3...0.12.4) (2020-02-07)


### expiration

* Allow to override expiring field ([0620231](https://github.com/neo9/n9-mongo-client/commit/0620231)) (Clement Petit)

### mongo

* Update mongodb driver to 3.5.2 ([ccec9d0](https://github.com/neo9/n9-mongo-client/commit/ccec9d0)) (Clement Petit)

### release

* V 0.12.4 ([b5e12c3](https://github.com/neo9/n9-mongo-client/commit/b5e12c3)) (Clement Petit)



## Version [0.12.3](https://github.com/neo9/n9-mongo-client/compare/0.12.2...0.12.3) (2020-01-23)


### aggregate

* Add option to force reading in main collection ([c22d6e6](https://github.com/neo9/n9-mongo-client/commit/c22d6e6)) (Benjamin Daniel)

### release

* V 0.12.3 ([2f8523b](https://github.com/neo9/n9-mongo-client/commit/2f8523b)) (Benjamin Daniel)



## Version [0.12.2](https://github.com/neo9/n9-mongo-client/compare/0.12.1...0.12.2) (2020-01-21)


### aggregate

* Fix merge stage type ([d39b07f](https://github.com/neo9/n9-mongo-client/commit/d39b07f)) (Benjamin Daniel)

### release

* V 0.12.2 ([44872e3](https://github.com/neo9/n9-mongo-client/commit/44872e3)) (Benjamin Daniel)



## Version [0.12.1](https://github.com/neo9/n9-mongo-client/compare/0.12.0...0.12.1) (2020-01-21)


### aggregate

* Add concat aggregation builder ([c773fa4](https://github.com/neo9/n9-mongo-client/commit/c773fa4)) (Benjamin Daniel)

### release

* V 0.12.1 ([ef90f5c](https://github.com/neo9/n9-mongo-client/commit/ef90f5c)) (Benjamin Daniel)



# Version [0.12.0](https://github.com/neo9/n9-mongo-client/compare/0.11.2...0.12.0) (2020-01-21)


### aggregate

* Add merge step to pipeline aggregation builder ([2a0d55d](https://github.com/neo9/n9-mongo-client/commit/2a0d55d)) (Benjamin Daniel)
* Force output collection for aggregation ([55d2231](https://github.com/neo9/n9-mongo-client/commit/55d2231)) (Benjamin Daniel)

### lockfields

* Add excluded fields filter ([1cfb726](https://github.com/neo9/n9-mongo-client/commit/1cfb726)) (Benjamin Daniel)

### release

* V 0.12.0 ([9f5ac26](https://github.com/neo9/n9-mongo-client/commit/9f5ac26)) (Benjamin Daniel)



## Version [0.11.2](https://github.com/neo9/n9-mongo-client/compare/0.11.1...0.11.2) (2020-01-11)


### release

* V 0.11.2 ([e25228b](https://github.com/neo9/n9-mongo-client/commit/e25228b)) (Benjamin Daniel)

### streams

* Fix streams queries building ([8c122c7](https://github.com/neo9/n9-mongo-client/commit/8c122c7)) (Benjamin Daniel)



## Version [0.11.1](https://github.com/neo9/n9-mongo-client/compare/0.11.0...0.11.1) (2019-12-20)


### release

* V 0.11.1 ([0e4bb4d](https://github.com/neo9/n9-mongo-client/commit/0e4bb4d)) (Benjamin Daniel)

### stream

* Fix conditions on _id field ([44ac5eb](https://github.com/neo9/n9-mongo-client/commit/44ac5eb)) (Clement Petit)



# Version [0.11.0](https://github.com/neo9/n9-mongo-client/compare/0.10.0...0.11.0) (2019-12-19)


### doc

* Add build instructions to README.md ([12cc931](https://github.com/neo9/n9-mongo-client/commit/12cc931)) (Gabriel ROQUIGNY)
* Add CONTRIBUTING.md ([980fc61](https://github.com/neo9/n9-mongo-client/commit/980fc61)) (Gabriel ROQUIGNY)

### feat

* Add array filters to FindOneAndUpdate ([d686952](https://github.com/neo9/n9-mongo-client/commit/d686952)) (Gabriel ROQUIGNY)

### release

* V 0.11.0 ([7a9a7bc](https://github.com/neo9/n9-mongo-client/commit/7a9a7bc)) (Benjamin Daniel)

### tests

* Add array filters to FindOneAndUpdate ([134b36b](https://github.com/neo9/n9-mongo-client/commit/134b36b)) (Gabriel ROQUIGNY)
* Add mongo start in memory server ([b54b8cf](https://github.com/neo9/n9-mongo-client/commit/b54b8cf)) (Gabriel ROQUIGNY)
* Use init function ([942db30](https://github.com/neo9/n9-mongo-client/commit/942db30)) (Gabriel ROQUIGNY)

### yarn

* Fix repository reference ([6fc6181](https://github.com/neo9/n9-mongo-client/commit/6fc6181)) (Benjamin Daniel)
* Fix repository reference ([0ca82b8](https://github.com/neo9/n9-mongo-client/commit/0ca82b8)) (Benjamin Daniel)



# Version [0.10.0](https://github.com/neo9/n9-mongo-client/compare/0.9.0...0.10.0) (2019-09-25)


### client

* Use options params for updateManyAtOnce ([01ce294](https://github.com/neo9/n9-mongo-client/commit/01ce294)) (Clement Petit)

### release

* V 0.10.0 ([9cda36f](https://github.com/neo9/n9-mongo-client/commit/9cda36f)) (Benjamin Daniel)



# Version [0.9.0](https://github.com/neo9/n9-mongo-client/compare/0.8.2...0.9.0) (2019-09-19)


### release

* V 0.9.0 ([15521db](https://github.com/neo9/n9-mongo-client/commit/15521db)) (Benjamin Daniel)



## Version [0.8.2](https://github.com/neo9/n9-mongo-client/compare/0.8.1...0.8.2) (2019-09-19)


### aggregation

* Add aggregation builder ([3fbe4e8](https://github.com/neo9/n9-mongo-client/commit/3fbe4e8)) (Clement Petit)

### client

* Add createExpirationIndex and createHistoricExpirationIndex methods ([5d0a01c](https://github.com/neo9/n9-mongo-client/commit/5d0a01c)) (Clement Petit)

### release

* V 0.8.2 ([d2298ec](https://github.com/neo9/n9-mongo-client/commit/d2298ec)) (Benjamin Daniel)



## Version [0.8.1](https://github.com/neo9/n9-mongo-client/compare/0.8.0...0.8.1) (2019-09-04)


### release

* V 0.8.1 ([a268960](https://github.com/neo9/n9-mongo-client/commit/a268960)) (Benjamin Daniel)

### stream

* Add forEachAsync alias to forEach ([2758683](https://github.com/neo9/n9-mongo-client/commit/2758683)) (Benjamin Daniel)



# Version [0.8.0](https://github.com/neo9/n9-mongo-client/compare/0.7.0...0.8.0) (2019-09-03)


### find

* Add collations parameters ([54b617d](https://github.com/neo9/n9-mongo-client/commit/54b617d)) (Cédric Ribeiro)

### lint

* Removed empty line ([77b044d](https://github.com/neo9/n9-mongo-client/commit/77b044d)) (Cédric Ribeiro)

### locks

* Add n9MongoLock to get distributed locks using MongoDB ([879da8e](https://github.com/neo9/n9-mongo-client/commit/879da8e)) (Benjamin Daniel)

### release

* V 0.8.0 ([c0ea0a8](https://github.com/neo9/n9-mongo-client/commit/c0ea0a8)) (Benjamin Daniel)

### yarn

* Upgrade dependencies to fix security alerts ([bc17200](https://github.com/neo9/n9-mongo-client/commit/bc17200)) (Benjamin Daniel)



# Version [0.7.0](https://github.com/neo9/n9-mongo-client/compare/0.6.5...0.7.0) (2019-07-25)


### mongo

* Add mongo uri with password test ([d509d28](https://github.com/neo9/n9-mongo-client/commit/d509d28)) (Maxime Fradin)
* Create regex only if uri exist ([671488b](https://github.com/neo9/n9-mongo-client/commit/671488b)) (Maxime Fradin)
* Hide password in mongo URI ([f9150d8](https://github.com/neo9/n9-mongo-client/commit/f9150d8)) (Maxime Fradin)

### release

* V 0.7.0 ([8506dcf](https://github.com/neo9/n9-mongo-client/commit/8506dcf)) (Benjamin Daniel)



## Version [0.6.5](https://github.com/neo9/n9-mongo-client/compare/0.6.4...0.6.5) (2019-07-22)


### release

* V 0.6.5 ([59edc2b](https://github.com/neo9/n9-mongo-client/commit/59edc2b)) (Benjamin Daniel)

### update

* Add options to not unset data on update many at once ([c60b555](https://github.com/neo9/n9-mongo-client/commit/c60b555)) (Benjamin Daniel)



## Version [0.6.4](https://github.com/neo9/n9-mongo-client/compare/0.6.3...0.6.4) (2019-07-18)


### delete

* Add delete many function ([aced93b](https://github.com/neo9/n9-mongo-client/commit/aced93b)) (Benjamin Daniel)

### release

* V 0.6.4 ([d2a89a7](https://github.com/neo9/n9-mongo-client/commit/d2a89a7)) (Benjamin Daniel)



## Version [0.6.3](https://github.com/neo9/n9-mongo-client/compare/0.6.2...0.6.3) (2019-07-18)


### release

* V 0.6.3 ([d978254](https://github.com/neo9/n9-mongo-client/commit/d978254)) (Benjamin Daniel)

### yarn

* Upgrade dependencies to fix security issues ([c149d41](https://github.com/neo9/n9-mongo-client/commit/c149d41)) (Benjamin Daniel)



## Version [0.6.2](https://github.com/neo9/n9-mongo-client/compare/0.6.1...0.6.2) (2019-07-18)


### release

* V 0.6.2 ([d099125](https://github.com/neo9/n9-mongo-client/commit/d099125)) (Benjamin Daniel)

### yarn

* Upgrade dependencies to fix security issues ([ff1c309](https://github.com/neo9/n9-mongo-client/commit/ff1c309)) (Benjamin Daniel)



## Version [0.6.1](https://github.com/neo9/n9-mongo-client/compare/0.6.0...0.6.1) (2019-07-18)


### perf

* Add options to not return inserted or updated value ([b3c30a7](https://github.com/neo9/n9-mongo-client/commit/b3c30a7)) (Benjamin Daniel)

### release

* V 0.6.1 ([83f7bd0](https://github.com/neo9/n9-mongo-client/commit/83f7bd0)) (Benjamin Daniel)



# Version [0.6.0](https://github.com/neo9/n9-mongo-client/compare/0.5.2...0.6.0) (2019-07-15)


### perf

* Improve performance and transpile to ES2018 ([60bb383](https://github.com/neo9/n9-mongo-client/commit/60bb383)) (Benjamin Daniel)

### release

* V 0.6.0 ([20674b1](https://github.com/neo9/n9-mongo-client/commit/20674b1)) (Benjamin Daniel)



## Version [0.5.2](https://github.com/neo9/n9-mongo-client/compare/0.5.1...0.5.2) (2019-07-15)


### mongo

* Add collection exists method ([f32f069](https://github.com/neo9/n9-mongo-client/commit/f32f069)) (Clement Petit)

### release

* V 0.5.2 ([62a97a8](https://github.com/neo9/n9-mongo-client/commit/62a97a8)) (Benjamin Daniel)

### tsconfig

* Fix bad identation ([4e70bec](https://github.com/neo9/n9-mongo-client/commit/4e70bec)) (Clement Petit)

### utils

* Allow to pass options to connect ([f80f6c6](https://github.com/neo9/n9-mongo-client/commit/f80f6c6)) (Clement Petit)



## Version [0.5.1](https://github.com/neo9/n9-mongo-client/compare/0.5.0...0.5.1) (2019-07-15)


### performance

* Allow projections to more function and add exists ([e26c481](https://github.com/neo9/n9-mongo-client/commit/e26c481)) (Benjamin Daniel)

### release

* V 0.5.1 ([3947e2c](https://github.com/neo9/n9-mongo-client/commit/3947e2c)) (Benjamin Daniel)



# Version [0.5.0](https://github.com/neo9/n9-mongo-client/compare/0.4.7...0.5.0) (2019-07-05)


### release

* V 0.5.0 ([b1e7676](https://github.com/neo9/n9-mongo-client/commit/b1e7676)) (Benjamin Daniel)



## Version [0.4.7](https://github.com/neo9/n9-mongo-client/compare/0.4.6...0.4.7) (2019-07-04)


### release

* V 0.4.7 ([27a2763](https://github.com/neo9/n9-mongo-client/commit/27a2763)) (Benjamin Daniel)

### update

* Add support of null value to remove entity value ([1417a21](https://github.com/neo9/n9-mongo-client/commit/1417a21)) (Benjamin Daniel)



## Version [0.4.6](https://github.com/neo9/n9-mongo-client/compare/0.4.5...0.4.6) (2019-07-04)


### mongo

* Fix primitive type mapping ([a392670](https://github.com/neo9/n9-mongo-client/commit/a392670)) (Clement Petit)

### release

* V 0.4.6 ([7e8d943](https://github.com/neo9/n9-mongo-client/commit/7e8d943)) (Benjamin Daniel)

### stream

* Add throw error if trying to project without _id ([3b4d056](https://github.com/neo9/n9-mongo-client/commit/3b4d056)) (Benjamin Daniel)



## Version [0.4.5](https://github.com/neo9/n9-mongo-client/compare/0.4.4...0.4.5) (2019-06-25)


### release

* V 0.4.5 ([9b6e655](https://github.com/neo9/n9-mongo-client/commit/9b6e655)) (Benjamin Daniel)

### types

* Fix stream types to match projection ([3193064](https://github.com/neo9/n9-mongo-client/commit/3193064)) (Benjamin Daniel)



## Version [0.4.4](https://github.com/neo9/n9-mongo-client/compare/0.4.3...0.4.4) (2019-06-25)


### release

* V 0.4.4 ([36d2264](https://github.com/neo9/n9-mongo-client/commit/36d2264)) (Benjamin Daniel)

### types

* Fix stream types to match projection ([bd849b4](https://github.com/neo9/n9-mongo-client/commit/bd849b4)) (Benjamin Daniel)



## Version [0.4.3](https://github.com/neo9/n9-mongo-client/compare/0.4.2...0.4.3) (2019-06-25)


### release

* V 0.4.3 ([16d6048](https://github.com/neo9/n9-mongo-client/commit/16d6048)) (Benjamin Daniel)

### types

* Fix find with type type to match projection ([bae25d1](https://github.com/neo9/n9-mongo-client/commit/bae25d1)) (Benjamin Daniel)



## Version [0.4.2](https://github.com/neo9/n9-mongo-client/compare/0.4.1...0.4.2) (2019-06-20)


### release

* V 0.4.2 ([7f6c2e4](https://github.com/neo9/n9-mongo-client/commit/7f6c2e4)) (Benjamin Daniel)

### stream

* Fix memory issue with collection stream ([7ef57d3](https://github.com/neo9/n9-mongo-client/commit/7ef57d3)) (Benjamin Daniel)



## Version [0.4.1](https://github.com/neo9/n9-mongo-client/compare/0.4.0...0.4.1) (2019-06-12)


### release

* V 0.4.1 ([2febb06](https://github.com/neo9/n9-mongo-client/commit/2febb06)) (Benjamin Daniel)

### stream

* Fix parallel issues ([e50251d](https://github.com/neo9/n9-mongo-client/commit/e50251d)) (Clement Petit)



# Version [0.4.0](https://github.com/neo9/n9-mongo-client/compare/0.3.3...0.4.0) (2019-06-06)


### client

* Add stream feature ([d44a92c](https://github.com/neo9/n9-mongo-client/commit/d44a92c)) (Clement Petit)

### release

* V 0.4.0 ([d1fad29](https://github.com/neo9/n9-mongo-client/commit/d1fad29)) (Benjamin Daniel)

### yarn

* Upgrade dependencies due to security issue ([0c727c8](https://github.com/neo9/n9-mongo-client/commit/0c727c8)) (Benjamin Daniel)



## Version [0.3.3](https://github.com/neo9/n9-mongo-client/compare/0.3.2...0.3.3) (2019-05-14)


### locks

* Improve locks on empty new values ([290e2d8](https://github.com/neo9/n9-mongo-client/commit/290e2d8)) (Benjamin Daniel)

### release

* V 0.3.3 ([128a694](https://github.com/neo9/n9-mongo-client/commit/128a694)) (Benjamin Daniel)



## Version [0.3.2](https://github.com/neo9/n9-mongo-client/compare/0.3.1...0.3.2) (2019-05-03)


### release

* V 0.3.2 ([88dc6a6](https://github.com/neo9/n9-mongo-client/commit/88dc6a6)) (Benjamin Daniel)

### updateMany

* Fix public function updateManyAtOnce definition ([a70407c](https://github.com/neo9/n9-mongo-client/commit/a70407c)) (Benjamin Daniel)



## Version [0.3.1](https://github.com/neo9/n9-mongo-client/compare/0.3.0...0.3.1) (2019-05-03)


### release

* V 0.3.1 ([219c89e](https://github.com/neo9/n9-mongo-client/commit/219c89e)) (Benjamin Daniel)

### updateMany

* Add current value to mapping function if any ([043cd94](https://github.com/neo9/n9-mongo-client/commit/043cd94)) (Benjamin Daniel)



# Version [0.3.0](https://github.com/neo9/n9-mongo-client/compare/0.2.4...0.3.0) (2019-04-18)


### delete

* Add delete one method and declinations byId and byKey ([5a740e2](https://github.com/neo9/n9-mongo-client/commit/5a740e2)) (Benjamin Daniel)

### release

* V 0.3.0 ([a7c50d3](https://github.com/neo9/n9-mongo-client/commit/a7c50d3)) (Benjamin Daniel)



## Version [0.2.4](https://github.com/neo9/n9-mongo-client/compare/0.2.3...0.2.4) (2019-04-17)


### release

* V 0.2.4 ([bbe8907](https://github.com/neo9/n9-mongo-client/commit/bbe8907)) (Benjamin Daniel)



## Version [0.2.3](https://github.com/neo9/n9-mongo-client/compare/0.2.2...0.2.3) (2019-04-17)


### release

* V 0.2.3 ([7e26f9a](https://github.com/neo9/n9-mongo-client/commit/7e26f9a)) (Benjamin Daniel)



## Version [0.2.2](https://github.com/neo9/n9-mongo-client/compare/0.2.1...0.2.2) (2019-04-10)


### insert

* Fix insert many with dots characters in keys ([d3bacb0](https://github.com/neo9/n9-mongo-client/commit/d3bacb0)) (Benjamin Daniel)

### release

* V 0.2.2 ([a291f19](https://github.com/neo9/n9-mongo-client/commit/a291f19)) (Benjamin Daniel)



## Version [0.2.1](https://github.com/neo9/n9-mongo-client/compare/0.2.0...0.2.1) (2019-04-10)


### fields

* Add support of dots and dollars in fields names ([8de0d64](https://github.com/neo9/n9-mongo-client/commit/8de0d64)) (Benjamin Daniel)

### release

* V 0.2.1 ([c864b13](https://github.com/neo9/n9-mongo-client/commit/c864b13)) (Benjamin Daniel)



# Version [0.2.0](https://github.com/neo9/n9-mongo-client/compare/0.1.12...0.2.0) (2019-04-08)


### release

* V 0.2.0 ([92a275a](https://github.com/neo9/n9-mongo-client/commit/92a275a)) (Benjamin Daniel)

### upsert

* Add new method to upsertOne (#4) ([18777b3](https://github.com/neo9/n9-mongo-client/commit/18777b3)), closes [#4](https://github.com/neo9/n9-mongo-client/issues/4) (pierremalletneo9)



## Version [0.1.12](https://github.com/neo9/n9-mongo-client/compare/0.1.11...0.1.12) (2019-03-14)


### bulk

* Fix bulk on more than 10 elements ([b889508](https://github.com/neo9/n9-mongo-client/commit/b889508)) (Benjamin Daniel)

### release

* V 0.1.12 ([0bbba0a](https://github.com/neo9/n9-mongo-client/commit/0bbba0a)) (Benjamin Daniel)

### yarn

* Use npmjs repository ([9cae581](https://github.com/neo9/n9-mongo-client/commit/9cae581)) (Benjamin Daniel)



## Version [0.1.11](https://github.com/neo9/n9-mongo-client/compare/0.1.10...0.1.11) (2019-02-18)


### release

* V 0.1.11 ([49be73e](https://github.com/neo9/n9-mongo-client/commit/49be73e)) (Benjamin Daniel)

### upsert

* Fix bulk updasert and improve test reading #1 #2 ([317ac85](https://github.com/neo9/n9-mongo-client/commit/317ac85)), closes [#1](https://github.com/neo9/n9-mongo-client/issues/1) [#2](https://github.com/neo9/n9-mongo-client/issues/2) [#1](https://github.com/neo9/n9-mongo-client/issues/1) [#2](https://github.com/neo9/n9-mongo-client/issues/2) (Benjamin DANIEL)



## Version [0.1.10](https://github.com/neo9/n9-mongo-client/compare/0.1.9...0.1.10) (2019-01-29)


### conf

* Fix defaultConfiguration overriding ([a02e676](https://github.com/neo9/n9-mongo-client/commit/a02e676)) (Benjamin DANIEL)

### release

* V 0.1.10 ([83cb24d](https://github.com/neo9/n9-mongo-client/commit/83cb24d)) (Benjamin DANIEL)



## Version [0.1.9](https://github.com/neo9/n9-mongo-client/compare/0.1.8...0.1.9) (2019-01-24)


### locks

* Fix array updates and add tests A,B,C,D ([4843d33](https://github.com/neo9/n9-mongo-client/commit/4843d33)) (Benjamin Daniel)
* Fix entity update with force override locks ([3a0f4b9](https://github.com/neo9/n9-mongo-client/commit/3a0f4b9)) (Benjamin Daniel)

### release

* V 0.1.9 ([b031f87](https://github.com/neo9/n9-mongo-client/commit/b031f87)) (Benjamin Daniel)



## Version [0.1.8](https://github.com/neo9/n9-mongo-client/compare/0.1.7...0.1.8) (2019-01-22)


### locks

* Fix sub object in array locks ([805bf36](https://github.com/neo9/n9-mongo-client/commit/805bf36)) (Benjamin Daniel)

### release

* V 0.1.8 ([543f613](https://github.com/neo9/n9-mongo-client/commit/543f613)) (Benjamin Daniel)



## Version [0.1.7](https://github.com/neo9/n9-mongo-client/compare/0.1.6...0.1.7) (2019-01-22)


### locks

* Fix sub object in array locks ([3fb4474](https://github.com/neo9/n9-mongo-client/commit/3fb4474)) (Benjamin Daniel)

### release

* V 0.1.7 ([0071fae](https://github.com/neo9/n9-mongo-client/commit/0071fae)) (Benjamin Daniel)



## Version [0.1.6](https://github.com/neo9/n9-mongo-client/compare/0.1.5...0.1.6) (2019-01-22)


### locks

* Update locks paths and fix boolean update ([999eb61](https://github.com/neo9/n9-mongo-client/commit/999eb61)) (Benjamin Daniel)

### release

* V 0.1.6 ([cb0d985](https://github.com/neo9/n9-mongo-client/commit/cb0d985)) (Benjamin Daniel)

### tests

* Add tests for mongo utils ([835c4e0](https://github.com/neo9/n9-mongo-client/commit/835c4e0)) (Benjamin Daniel)



## Version [0.1.5](https://github.com/neo9/n9-mongo-client/compare/0.1.4...0.1.5) (2019-01-21)


### locks

* Fix lock fields on update ([3501d5d](https://github.com/neo9/n9-mongo-client/commit/3501d5d)) (Benjamin Daniel)

### release

* V 0.1.5 ([1fbf7b1](https://github.com/neo9/n9-mongo-client/commit/1fbf7b1)) (Benjamin Daniel)

### tests

* Add more tests for mongo utils and date transformer ([e56cc22](https://github.com/neo9/n9-mongo-client/commit/e56cc22)) (Benjamin Daniel)
* Organise tests ([7e06f35](https://github.com/neo9/n9-mongo-client/commit/7e06f35)) (Benjamin Daniel)



## Version [0.1.4](https://github.com/neo9/n9-mongo-client/compare/0.1.3...0.1.4) (2019-01-21)


### locks

* Fix lock fields on update ([c95bad1](https://github.com/neo9/n9-mongo-client/commit/c95bad1)) (Benjamin Daniel)

### release

* V 0.1.4 ([3cded51](https://github.com/neo9/n9-mongo-client/commit/3cded51)) (Benjamin Daniel)



## Version [0.1.3](https://github.com/neo9/n9-mongo-client/compare/0.1.2...0.1.3) (2019-01-21)


### git

* Add pre-commit and pre-push hooks ([3b3581c](https://github.com/neo9/n9-mongo-client/commit/3b3581c)) (Benjamin Daniel)

### locks

* Fix some bugs ([9fe19e8](https://github.com/neo9/n9-mongo-client/commit/9fe19e8)) (Benjamin Daniel)
* Fix update with locks ([5e486f6](https://github.com/neo9/n9-mongo-client/commit/5e486f6)) (Benjamin Daniel)
* Save only changed fields locks on update ([470e8ce](https://github.com/neo9/n9-mongo-client/commit/470e8ce)) (Benjamin Daniel)

### release

* V 0.1.3 ([1d85048](https://github.com/neo9/n9-mongo-client/commit/1d85048)) (Benjamin Daniel)



## Version [0.1.2](https://github.com/neo9/n9-mongo-client/compare/0.1.1...0.1.2) (2019-01-18)


### locks

* Add option to override locks ([c2022dd](https://github.com/neo9/n9-mongo-client/commit/c2022dd)) (Benjamin Daniel)

### release

* V 0.1.2 ([1549035](https://github.com/neo9/n9-mongo-client/commit/1549035)) (Benjamin Daniel)



## Version [0.1.1](https://github.com/neo9/n9-mongo-client/compare/0.1.0...0.1.1) (2019-01-18)


### locks

* Add function to remove one lock on one entity ([8df9474](https://github.com/neo9/n9-mongo-client/commit/8df9474)) (Benjamin Daniel)

### release

* V 0.1.1 ([1b1b5f3](https://github.com/neo9/n9-mongo-client/commit/1b1b5f3)) (Benjamin Daniel)



# Version [0.1.0](https://github.com/neo9/n9-mongo-client/compare/0.0.1...0.1.0) (2019-01-17)


### locks

* Add lock fields on create ([c7e04a1](https://github.com/neo9/n9-mongo-client/commit/c7e04a1)) (Benjamin Daniel)
* Add lock fields update and update many ([e9d456d](https://github.com/neo9/n9-mongo-client/commit/e9d456d)) (Benjamin Daniel)
* Fix _id case and add todos ([a3ab8af](https://github.com/neo9/n9-mongo-client/commit/a3ab8af)) (Benjamin Daniel)
* Fix tests and disconnect from mongodb ([50a5a67](https://github.com/neo9/n9-mongo-client/commit/50a5a67)) (Benjamin Daniel)

### npm

* Add link to repository ([412092c](https://github.com/neo9/n9-mongo-client/commit/412092c)) (Benjamin Daniel)

### release

* V 0.1.0 ([ba52283](https://github.com/neo9/n9-mongo-client/commit/ba52283)) (Benjamin Daniel)

### update

* Add findOneAndUpdateByKey function ([5df6c42](https://github.com/neo9/n9-mongo-client/commit/5df6c42)) (Benjamin Daniel)



## Version [0.0.1](https://github.com/neo9/n9-mongo-client/compare/6b55a90...0.0.1) (2018-11-26)


### base

* Add basic client with one test ([6b55a90](https://github.com/neo9/n9-mongo-client/commit/6b55a90)) (Benjamin Daniel)

### release

* Add release library ([47f155e](https://github.com/neo9/n9-mongo-client/commit/47f155e)) (Benjamin Daniel)
* V 0.0.1 ([5510566](https://github.com/neo9/n9-mongo-client/commit/5510566)) (Benjamin Daniel)



