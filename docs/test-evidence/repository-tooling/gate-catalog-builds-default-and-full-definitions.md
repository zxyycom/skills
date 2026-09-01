### Case GATE-DEFINITION-CATALOG-001: 语义门禁目录构造准确的 default 与 full Definition

Entry:
- `scripts/vibe-check.test.ts > gate catalog builds semantic default and full Definitions`
- `bun test --test-name-pattern="^gate catalog builds semantic default and full Definitions$" ./scripts/vibe-check.test.ts`

Contract:
- 同一 catalog 必须以稳定语义 ID 构造日常 default 与发布 full；原聚合 package script 继续可直接调用，但不再充当领域测试 leaf。语义拆分保持原 profile 覆盖，并将 release 表达为普通 Check、版本校验和打包三个责任层。

Proves:
- Change Plan、Decision Records、Investigation Report、Task Graph 与 Test Evidence 分别展开为 `3/5/5/7/5` 个语义 Check；58 个原聚合测试文件各出现一次，只有 native-store 使用 Node，多文件 Bun Check 通过单一窄 runner 顺序导入所属测试文件。
- default/full Check ID、profile 和固定命令精确匹配独立期望；full 的 56 个普通前置全部进入 `release:skill-version`，`pack:skills` 只依赖该版本节点。Definition 继续使用静态并发 4、progress 与 machine publication，并关闭 diagnostic log。
