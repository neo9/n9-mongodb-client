## Version [0.13.1](https://github.com/neo9/n9-mongo-client/compare/0.13.0...0.13.1) (2020-02-28)


### locks

* Fix locks expiring ([eef34f8](https://github.com/neo9/n9-mongo-client/commit/eef34f8)) (Benjamin Daniel)



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



