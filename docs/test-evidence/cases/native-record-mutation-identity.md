### Case NATIVE-RECORD-MUTATION-IDENTITY-001: 候选身份和删除的局部事务

Tests:
- `test:48c73cfdda737660d9c70450ee786bd5dd4a562f08bd599ca18b3704a722dde3`
- `test:653bbc8b7a209b756a203ba3840dbb47b2c503720e931b3e64fb90bd0c5d8bef`
- `test:665561a600d77d552bea4f3ef2351717cea5e995043419c6d35f4c06e42e84da`
- `test:7f473c36cc7dd9a13647c768927fa1782093fb6c28be94828abf6088c1a45d4f`
- `test:8a884f3dd1b301d3859f85fb1080bd595a8f8476648854f1111291159ab846eb`
- `test:bdf470a73b533262194f4d0f3c8ad6cd91a258c7dc847615a5d45391f8c1f12f`
- `test:f5ba748ea7eb0645183ef047f481691cde1cb3f48ae970451a17f711dab08e9e`

Tags:
- `record-rust`

Contract:
- 身份分配、rename 或删除须保护已存在内容和受引用对象。

Proves:
- 私有候选与索引验证冲突、no-op、正式引用及两域 rename 的身份和资源引用更新。
