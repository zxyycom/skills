### Case NATIVE-RECORD-SOURCE-REVISION-001: 两域来源 revision 字节计算

Tests:
- `test:1d9828351c26a30f4f53836da4c066271d3eb82d2e87421bd3fe74e9d8399596`
- `test:d450556d26d89627e27522529305f48f79cf42186ad13dd1d0cb06c34b55acc7`

Tags:
- `record-rust`

Contract:
- 来源指纹须反映各领域规定的字节与换行语义。

Proves:
- 独立预期字节验证 metadata fingerprint 和领域换行差异。
