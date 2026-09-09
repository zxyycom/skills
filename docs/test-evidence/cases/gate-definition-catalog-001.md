### Case GATE-DEFINITION-CATALOG-001: Gate 完整 Definition 声明原生选择与资源调度

Tests:
- `test:e55fd378031c8b4a9ad69bf1050581562ad6226fa6242e26c5fea6c3b4dd77f0`

Tags:
- `repository-tooling`

Contract:
- 每次 Gate Definition 都必须包含同一完整稳定 Check ID 集合；release-only Check 与日常增量 Check 以 `enabledByFlags` 声明选择和依赖传播，scheduler 使用原生 learned strategy、四槽上限、三个外部进程和两个仓库扫描容量。

Proves:
- Change Plan、Decision Records、Investigation Report、Task Graph 与 Test Evidence 分别展开为 `3/5/5/8/5` 个语义 Check；67 个当前测试文件各出现一次，只有 native-store 使用 Node，多文件 Bun Check 通过单一窄 runner 顺序导入所属测试文件。
- base/release/增量 Definition Check ID 完全相同，七项 Vibe 原生 Check 与语义 Check 的 release 或内部 activation 条件、固定命令精确匹配独立期望；release prepare、version 和 pack 保持原 DAG，带依赖的 Check 传播传递前置，非 base ID 不能进入日常 activation。
- Definition 使用 learned custom admission、`maxParallel: 4`、三个外部进程和两个仓库扫描容量；命令型 package/semantic Check 分别声明一个外部进程 unit。
