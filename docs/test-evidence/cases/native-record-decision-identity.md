### Case NATIVE-RECORD-DECISION-IDENTITY-001: 决策身份修改与引用更新

Tests:
- `test:1c465af311b52c0329fe899ef38272b8b71b9a6eceb98f0d4396c120cfc4445d`
- `test:1ef283703a3c84fb1006fffe155d15b37ceb21971ce4cdc3e4ee3a4c06713426`
- `test:1fd2828410042efca7e832a379aa21056ce7ced025f92b12bdfcef1ac361a597`
- `test:21e8c2a4bdaac7e6b7e691b2d69849594547db18cdcb795dd3e730b236a48bb5`
- `test:2ca385e8f555a6015e0b130fe50e5a9744a40c64a7951ef0a927aa45115373dc`
- `test:5c26f163fc4d327c24a5ed9a2d52fea17921e888ea1ea95a75836f82632bb1c0`
- `test:6251dc1300265d603e7385cb11b54fd6b8a390125da3796c7feadbc30d032684`
- `test:9e91b55189d7bf9d253a69d1222548c9f48a77c08521aadd6b953cfe768bc87b`
- `test:ace078cbf203c835d7f02c733fb568d9c7c20c08e23edfc125fcbdd8e2b575fc`
- `test:b03b2ac4a8adc80acda16605b6e7078ee4e2f503f68186b1127493e1053e00a4`
- `test:c0d66e3c64a0eb6bf37d71303c915b5c335591cf4847d9f8c364564e1583a001`
- `test:c7b77e3480cd103c9c986380fecd1c5d137e58e9e4f7d689afeed1bdae20a0ba`

Tags:
- `record-rust`

Contract:
- 决策候选及正式身份变更须区分历史确认、引用、普通冲突及来源有效性。

Proves:
- 私有来源与必要真实 Git 验证 rename、discard、no-op、引用、旧身份及无效历史。
