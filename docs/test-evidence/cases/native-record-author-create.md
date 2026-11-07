### Case NATIVE-RECORD-AUTHOR-CREATE-001: 双域候选新建和选择器

Tests:
- `test:2bd9b5fca5f4a1fd8ae31d268baaad2e09d63d193f0bbef80b49ca72b052434a`
- `test:754788a0576242dabbf86395455864553d0087506d9fd07562364a9a2672a703`
- `test:bbc0bb0002ae0f36e5116dc64f2c5952124cb70d96d1d636dc31cd72af350c4e`
- `test:ca15550b11c85b8cc8feb14c2a72644a732ec1bc9433aa95e4caf54cf96f5332`
- `test:d8cfae767c4ab8d10cd28e3a5b6ed468ffa1bf6ad795db9d9c4a75652b21325b`
- `test:e69da66b29e094f28020d5e95e6ee239f428954736cf573b63f004d407c2a9e1`
- `test:e953dbdcff49169f59254b8f60827a2b2609b83fd76f8e181c1c6e214026c928`

Tags:
- `record-rust`

Contract:
- 候选创建须验证身份及关系选择，拒绝冲突且不覆盖既有内容。

Proves:
- 私有源验证两域首次创建、未就绪 scaffold、歧义、无效输入及既有资源保留。
