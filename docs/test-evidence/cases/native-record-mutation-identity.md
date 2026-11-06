### Case NATIVE-RECORD-MUTATION-IDENTITY-001: 候选身份和删除的局部事务

Tests:
- `test:48c73cfdda737660d9c70450ee786bd5dd4a562f08bd599ca18b3704a722dde3`
- `test:49e415d991a9193174a0b7d2cf281d9f61720210df8395e12059e976c5d73e7d`
- `test:559fb79eff2978a5cbf4009eeb4c1ef8d7c1d49dbe863a26dcfe4499216ff9c0`
- `test:653bbc8b7a209b756a203ba3840dbb47b2c503720e931b3e64fb90bd0c5d8bef`
- `test:665561a600d77d552bea4f3ef2351717cea5e995043419c6d35f4c06e42e84da`
- `test:7f473c36cc7dd9a13647c768927fa1782093fb6c28be94828abf6088c1a45d4f`
- `test:8a884f3dd1b301d3859f85fb1080bd595a8f8476648854f1111291159ab846eb`
- `test:a43b1b74e0c91c37330cb39ffc180cc63f872390f36f576dccdd71c6990e3846`

Tags:
- `record-rust`

Contract:
- 身份分配、rename 或删除须保护已存在内容和受引用对象。

Proves:
- 私有候选与索引验证冲突、no-op、正式引用和失败时的条件恢复。
