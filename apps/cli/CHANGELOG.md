# Changelog

## [2.0.0](https://github.com/uoplan/uoplan/compare/uoplan-v1.0.1...uoplan-v2.0.0) (2026-07-01)


### ⚠ BREAKING CHANGES

* **web:** split code into modules, add browser tests, rework proto

### Features

* add uoplan cli base ([493c368](https://github.com/uoplan/uoplan/commit/493c36813d6653b5938f25ee593a6026b5477fbd))
* add uoplan run command ([c727ea6](https://github.com/uoplan/uoplan/commit/c727ea64b0ce03f073ffedf5ed865b59b1bbf5e8))
* **cli:** add course enrolment and deletion with cart ([aa34cec](https://github.com/uoplan/uoplan/commit/aa34cecfa0f9e6f2510b48e5b244359e8bb503c5))
* **cli:** add course search and cart addition flow ([03dad01](https://github.com/uoplan/uoplan/commit/03dad01ca78ffade24ae781a03f59b50bc7e2bdf))
* **cli:** add firefox support ([d0e938a](https://github.com/uoplan/uoplan/commit/d0e938ad5a83731c3f7fef653e7e43925f95c5e1))
* **cli:** add publish script ([162a167](https://github.com/uoplan/uoplan/commit/162a1673cf7d182cbb3760cd7015c957884e045f))
* **cli:** add run subcommand ([def9946](https://github.com/uoplan/uoplan/commit/def99468f684e4d1bc284502682e9973664aad64))
* **cli:** add term selector ([413604b](https://github.com/uoplan/uoplan/commit/413604b8e397e72cbbec27d700698d1e8c04960f))
* **cli:** add timing to cli run subcommand ([fe51f33](https://github.com/uoplan/uoplan/commit/fe51f33f280c8b2b8d17c0cb68ff46a2d6ed3d29))
* **cli:** add update cache and version check logic ([e4d0ce2](https://github.com/uoplan/uoplan/commit/e4d0ce27e79ef76246cd39a2738c86168732c02f))
* **cli:** add update subcommand ([0bc13da](https://github.com/uoplan/uoplan/commit/0bc13da96b17554f48f442c96f1149507d7c04d4))
* **cli:** improve ux experience for cli ([b268561](https://github.com/uoplan/uoplan/commit/b2685611ec4378935936ba740a871d60d5f26ad7))
* **cli:** make the cli crossplatform ([996e41f](https://github.com/uoplan/uoplan/commit/996e41f5a82bc591db49a21a02e145f1e1665671))
* **cli:** make the cli log in experience better ([c490150](https://github.com/uoplan/uoplan/commit/c490150ed113fe11063a2a969602a285ab4a9938))
* **cli:** match ux of rust port to original typescript ([99982a5](https://github.com/uoplan/uoplan/commit/99982a535146619b016a0f724ef8400a45798882))
* **cli:** persist term selection across logins ([1ad72d7](https://github.com/uoplan/uoplan/commit/1ad72d735ae346428e31698944f1ab7a9698ce7c))
* **cli:** replace typescript cli with rust implementation ([ed810c3](https://github.com/uoplan/uoplan/commit/ed810c3fed30b008fd0561e6157f03bcf28559cd))
* **cli:** wire passive update check and update subcommand ([0bfc5d4](https://github.com/uoplan/uoplan/commit/0bfc5d43a0f9ba07e3b802e5cc1c92f2c4fcc4f4))


### Bug Fixes

* **cli:** match release-please tag scheme (uoplan-v*) for self-update ([686ca85](https://github.com/uoplan/uoplan/commit/686ca85df59489788647e1142bad95e1aa3db896))
* **cli:** parse icsid properly ([4f84a59](https://github.com/uoplan/uoplan/commit/4f84a59f6807c22eea57b2a7b9116a3938984c77))
* **cli:** pass session properly ([978dc55](https://github.com/uoplan/uoplan/commit/978dc55f54ac73586549e5110fbd907263308593))
* **cli:** properly reuse term selection ([ccce826](https://github.com/uoplan/uoplan/commit/ccce82623acd007add475ee135168a171237559d))
* **cli:** resolve various bugs with term persistence ([708b614](https://github.com/uoplan/uoplan/commit/708b614d550239ffba58038530da9ac7a1e2f0e7))
* **cli:** update readme ([a2e0d5a](https://github.com/uoplan/uoplan/commit/a2e0d5a09c160bfad042da6aca7af2171c79942b))


### Code Refactoring

* **web:** split code into modules, add browser tests, rework proto ([ca2eca6](https://github.com/uoplan/uoplan/commit/ca2eca6fc820ac3e53d9af1d16c030e9b473d705))

## [1.0.1](https://github.com/uoplan/uoplan/compare/uoplan-v1.0.0...uoplan-v1.0.1) (2026-06-28)


### Bug Fixes

* **cli:** match release-please tag scheme (uoplan-v*) for self-update ([5c2403b](https://github.com/uoplan/uoplan/commit/5c2403bcaa172ddae96a66c4960192544f29a7f6))

## [1.0.0](https://github.com/uoplan/uoplan/compare/uoplan-v0.4.2...uoplan-v1.0.0) (2026-05-29)


### ⚠ BREAKING CHANGES

* **web:** split code into modules, add browser tests, rework proto

### Code Refactoring

* **web:** split code into modules, add browser tests, rework proto ([1efa04c](https://github.com/uoplan/uoplan/commit/1efa04ce67d515f59081e6e67e4fcc4872987a26))

## [0.4.2](https://github.com/uoplan/uoplan/compare/uoplan-v0.4.1...uoplan-v0.4.2) (2026-05-25)


### Bug Fixes

* **cli:** update readme ([469e3c4](https://github.com/uoplan/uoplan/commit/469e3c411b71c775f4c211a00f3b3977302ab160))

## [0.4.1](https://github.com/uoplan/uoplan/compare/uoplan-v0.4.0...uoplan-v0.4.1) (2026-05-23)


### Bug Fixes

* **cli:** resolve various bugs with term persistence ([5280022](https://github.com/uoplan/uoplan/commit/5280022a5d4aeb0276b614574f775a628be17bb7))

## [0.4.0](https://github.com/uoplan/uoplan/compare/uoplan-v0.3.0...uoplan-v0.4.0) (2026-05-23)


### Features

* **cli:** improve ux experience for cli ([8f92429](https://github.com/uoplan/uoplan/commit/8f9242910924a8acb52dbc89c38a7c998426bc93))

## [0.3.0](https://github.com/uoplan/uoplan/compare/uoplan-v0.2.0...uoplan-v0.3.0) (2026-05-21)


### Features

* add uoplan cli base ([7d16520](https://github.com/uoplan/uoplan/commit/7d165209cb8a3dd1e97eac9d7bf0219af13f33d6))
* add uoplan run command ([a921b4a](https://github.com/uoplan/uoplan/commit/a921b4aca2f64999c385afcf795bd70b46f4080d))
* **cli:** add course enrolment and deletion with cart ([b1766ee](https://github.com/uoplan/uoplan/commit/b1766eebc8cdce94007ddfb95ad6e07e37206d08))
* **cli:** add course search and cart addition flow ([2ff49c5](https://github.com/uoplan/uoplan/commit/2ff49c5bd67dbbf00246889df4e954657bb6939a))
* **cli:** add firefox support ([0fd3b63](https://github.com/uoplan/uoplan/commit/0fd3b6372c45fde872d280b2a61c74c894484a85))
* **cli:** add publish script ([b7fea4e](https://github.com/uoplan/uoplan/commit/b7fea4e38ba6997344c8f9badbfc57ef83d38c7d))
* **cli:** add run subcommand ([37e9c0e](https://github.com/uoplan/uoplan/commit/37e9c0e093923df4a18280ade6c52fe27f745811))
* **cli:** add term selector ([7c0c830](https://github.com/uoplan/uoplan/commit/7c0c830ec598210156882bd6dcf5222efe0cea82))
* **cli:** add timing to cli run subcommand ([11b9806](https://github.com/uoplan/uoplan/commit/11b980668a747b071f4d467f770cb77c2e8694c6))
* **cli:** add update cache and version check logic ([484e0ed](https://github.com/uoplan/uoplan/commit/484e0ed9b124eb8035781f1a6c9faefaf5ac5be0))
* **cli:** add update subcommand ([7a31b85](https://github.com/uoplan/uoplan/commit/7a31b85e02870a882de1a7163fbaaa2d599e4e05))
* **cli:** make the cli crossplatform ([18f45f1](https://github.com/uoplan/uoplan/commit/18f45f13959b368d6ff3b6e53782805218f6e2c3))
* **cli:** make the cli log in experience better ([5330638](https://github.com/uoplan/uoplan/commit/533063892923575a523a2729379cb470a8941a4f))
* **cli:** match ux of rust port to original typescript ([56c6c70](https://github.com/uoplan/uoplan/commit/56c6c70cbb6b481d9914f84114bbb3bee769e4f2))
* **cli:** persist term selection across logins ([f2d5a56](https://github.com/uoplan/uoplan/commit/f2d5a56601a579ad2cb7a00e976dd31925d71cde))
* **cli:** replace typescript cli with rust implementation ([2dd2195](https://github.com/uoplan/uoplan/commit/2dd2195860b57280424fe4bcd18ba42d3d8dabcb))
* **cli:** wire passive update check and update subcommand ([03c1b5a](https://github.com/uoplan/uoplan/commit/03c1b5af454ead681912f68e0650cf587e13a270))


### Bug Fixes

* **cli:** parse icsid properly ([e48186f](https://github.com/uoplan/uoplan/commit/e48186f82e39b8bfb68e52f8b032084c0c3e3406))
* **cli:** pass session properly ([85b3dd4](https://github.com/uoplan/uoplan/commit/85b3dd4a59717887334c43a661a9099a5ca5cc00))
* **cli:** properly reuse term selection ([ae1392a](https://github.com/uoplan/uoplan/commit/ae1392aedbf2718266b5cbbebd4c8eef63968ac2))

## [0.2.0](https://github.com/uoplan/uoplan/compare/uoplan-v0.1.0...uoplan-v0.2.0) (2026-05-20)


### Features

* add uoplan cli base ([7d16520](https://github.com/uoplan/uoplan/commit/7d165209cb8a3dd1e97eac9d7bf0219af13f33d6))
* add uoplan run command ([a921b4a](https://github.com/uoplan/uoplan/commit/a921b4aca2f64999c385afcf795bd70b46f4080d))
* **cli:** add course enrolment and deletion with cart ([b1766ee](https://github.com/uoplan/uoplan/commit/b1766eebc8cdce94007ddfb95ad6e07e37206d08))
* **cli:** add course search and cart addition flow ([2ff49c5](https://github.com/uoplan/uoplan/commit/2ff49c5bd67dbbf00246889df4e954657bb6939a))
* **cli:** add firefox support ([0fd3b63](https://github.com/uoplan/uoplan/commit/0fd3b6372c45fde872d280b2a61c74c894484a85))
* **cli:** add publish script ([b7fea4e](https://github.com/uoplan/uoplan/commit/b7fea4e38ba6997344c8f9badbfc57ef83d38c7d))
* **cli:** add run subcommand ([37e9c0e](https://github.com/uoplan/uoplan/commit/37e9c0e093923df4a18280ade6c52fe27f745811))
* **cli:** add term selector ([7c0c830](https://github.com/uoplan/uoplan/commit/7c0c830ec598210156882bd6dcf5222efe0cea82))
* **cli:** add timing to cli run subcommand ([11b9806](https://github.com/uoplan/uoplan/commit/11b980668a747b071f4d467f770cb77c2e8694c6))
* **cli:** add update cache and version check logic ([484e0ed](https://github.com/uoplan/uoplan/commit/484e0ed9b124eb8035781f1a6c9faefaf5ac5be0))
* **cli:** add update subcommand ([7a31b85](https://github.com/uoplan/uoplan/commit/7a31b85e02870a882de1a7163fbaaa2d599e4e05))
* **cli:** make the cli crossplatform ([18f45f1](https://github.com/uoplan/uoplan/commit/18f45f13959b368d6ff3b6e53782805218f6e2c3))
* **cli:** make the cli log in experience better ([5330638](https://github.com/uoplan/uoplan/commit/533063892923575a523a2729379cb470a8941a4f))
* **cli:** match ux of rust port to original typescript ([56c6c70](https://github.com/uoplan/uoplan/commit/56c6c70cbb6b481d9914f84114bbb3bee769e4f2))
* **cli:** persist term selection across logins ([f2d5a56](https://github.com/uoplan/uoplan/commit/f2d5a56601a579ad2cb7a00e976dd31925d71cde))
* **cli:** replace typescript cli with rust implementation ([2dd2195](https://github.com/uoplan/uoplan/commit/2dd2195860b57280424fe4bcd18ba42d3d8dabcb))
* **cli:** wire passive update check and update subcommand ([03c1b5a](https://github.com/uoplan/uoplan/commit/03c1b5af454ead681912f68e0650cf587e13a270))


### Bug Fixes

* **cli:** parse icsid properly ([e48186f](https://github.com/uoplan/uoplan/commit/e48186f82e39b8bfb68e52f8b032084c0c3e3406))
* **cli:** pass session properly ([85b3dd4](https://github.com/uoplan/uoplan/commit/85b3dd4a59717887334c43a661a9099a5ca5cc00))
* **cli:** properly reuse term selection ([ae1392a](https://github.com/uoplan/uoplan/commit/ae1392aedbf2718266b5cbbebd4c8eef63968ac2))
