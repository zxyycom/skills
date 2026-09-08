### Case GATE-DEFINITION-CATALOG-001: Gate 完整 Definition 以 release tag 控制 activation

Tests:
- `test:e55fd378031c8b4a9ad69bf1050581562ad6226fa6242e26c5fea6c3b4dd77f0`

Tags:
- `repository-tooling`

Contract:
- 每次 Gate Definition 都必须包含同一完整稳定 Check ID 集合；base 只聚合不需要 tag 的 32 个 Check，release tag 激活全部 60 个 Check 与 release DAG。

Proves:
- Change Plan、Decision Records、Investigation Report、Task Graph 与 Test Evidence 分别展开为 `3/5/5/8/5` 个语义 Check；66 个当前测试文件各出现一次，只有 native-store 使用 Node，多文件 Bun Check 通过单一窄 runner 顺序导入所属测试文件。
- base/release Definition Check ID 完全相同，语义 Check 的 requiredTag 和固定命令精确匹配独立期望；release 的 `release:skill-prepare` 没有普通前置且处于 Definition 首位，`release:skill-version` 依赖由 catalog 派生的全部普通前置和 prepare，`pack:skills` 只依赖版本节点。Definition 继续使用静态并发 4、progress 与 machine publication，并关闭 diagnostic log。
