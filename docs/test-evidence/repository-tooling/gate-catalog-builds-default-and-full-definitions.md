### Case GATE-DEFINITION-CATALOG-001: 语义门禁目录构造包含提前 release snapshot 的 default 与 full Definition

Entry:
- `scripts/vibe-check.test.ts > gate catalog builds semantic default and full Definitions`
- `bun test --test-name-pattern="^gate catalog builds semantic default and full Definitions$" ./scripts/vibe-check.test.ts`

Contract:
- 同一 catalog 必须以稳定语义 ID 构造日常 default 与发布 full；原聚合 package script 继续可直接调用，但不再充当领域测试 leaf。语义拆分保持原 profile 覆盖，full 将 release 表达为提前 snapshot prepare、普通 Check、版本授权和打包四层。

Proves:
- Change Plan、Decision Records、Investigation Report、Task Graph 与 Test Evidence 分别展开为 `3/5/5/8/5` 个语义 Check；当前测试文件各出现一次，只有 native-store 使用 Node，多文件 Bun Check 通过单一窄 runner 顺序导入所属测试文件。
- default/full Check ID、profile 和固定命令精确匹配独立期望；full 的 `release:skill-prepare` 没有普通前置且处于 Definition 首位，`release:skill-version` 依赖由 catalog 派生的全部普通前置和 prepare，`pack:skills` 只依赖版本节点。Definition 继续使用静态并发 4、progress 与 machine publication，并关闭 diagnostic log。
