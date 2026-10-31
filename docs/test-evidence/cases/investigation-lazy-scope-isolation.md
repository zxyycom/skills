### Case INVESTIGATION-LAZY-SCOPE-001: 替换与回滚快照各自独立构图

Tests:
- `test:48eb3d0df598ab6639e8b770ca0ebaa1c8fbcd3c44ca12a08101704e6a1e6205`

Tags:
- `investigation-report`

Contract:
- 每次实际替换或恢复集合都建立独立图作用域，不能以 Map 身份复用旧快照图。

Proves:
- 同一输入 Map 的替换与恢复各自产生不同图引用；旧/新上下文返回各自准确后继，原始关系未污染，恢复图 edges 与原图一致。
