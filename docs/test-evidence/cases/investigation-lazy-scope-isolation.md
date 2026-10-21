### Case INVESTIGATION-LAZY-SCOPE-001: 替换与回滚快照各自独立构图

Tests:
- `test:058222e67664cacfe94d0ac2681b75a3f44b8b8b95c0a73ddc2db9f257015a91`

Tags:
- `investigation-report`

Contract:
- 每次实际替换或恢复集合都建立独立图作用域，不能以 Map 身份复用旧快照图。

Proves:
- 同一 Map 中替换 next、恢复 next 后产生三个不同图；原图和替换图各自保持正确的后继，原关系未被污染，原始/替换关系投影计数只随各自新作用域增长。
