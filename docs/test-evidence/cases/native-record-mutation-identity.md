### Case NATIVE-RECORD-MUTATION-IDENTITY-001: 候选身份和删除的局部事务

Tests:
- `test:0333cecf9d45fa5ea7ce63630c4a2ef293774056196b6c61d624273f895ca041`
- `test:48c73cfdda737660d9c70450ee786bd5dd4a562f08bd599ca18b3704a722dde3`
- `test:559fb79eff2978a5cbf4009eeb4c1ef8d7c1d49dbe863a26dcfe4499216ff9c0`
- `test:653bbc8b7a209b756a203ba3840dbb47b2c503720e931b3e64fb90bd0c5d8bef`
- `test:665561a600d77d552bea4f3ef2351717cea5e995043419c6d35f4c06e42e84da`
- `test:7f473c36cc7dd9a13647c768927fa1782093fb6c28be94828abf6088c1a45d4f`
- `test:8a884f3dd1b301d3859f85fb1080bd595a8f8476648854f1111291159ab846eb`
- `test:c7756c3ef850a030f4b54fed6f2b3728b6aa1642036d4f98f63a8262cba81f29`

Tags:
- `record-rust`

Contract:
- 身份分配、rename 或删除须保护已存在内容和受引用对象。

Proves:
- 私有候选与索引验证冲突、no-op、正式引用；复制后失败保留源、副本及实际写集，不将部分完成描述为回滚。
