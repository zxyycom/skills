### Case NATIVE-RECORD-FROZEN-VERSION-001: 正式构建版本来自冻结源码

Tests:
- `test:d2819b75df688bbc559f63367c4041c24144cf7584d550d925380c6994c6a786`

Tags:
- `record-delivery`

Contract:
- 正式原生资产的运行时版本必须取自冻结源码的 Cargo package 版本。

Proves:
- 不同冻结版本分别被读取，依赖版本不被误认；缺失、非法和重复版本被拒绝。
