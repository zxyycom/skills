# Novel Cards 本地工具

字段与历史效力由 [卡片契约](../../skills/novel-cards/references/card-contract.md) 承接，命令、批量输入与恢复由 [CLI 契约](../../skills/novel-cards/references/local-cli.md) 承接。本目录只维护解析、文件扫描、图校验、索引集成、查询、批量变迁事务与 CLI 源码及原生测试；使用现有 Index Runtime，不改变共享协议。

## 维护职责与验证

源码按领域解析与图校验、来源扫描与索引、查询、批量变迁与事务、CLI 参数和结果映射分工。测试对应覆盖领域与历史、来源安全与索引、查询和章节、事务恢复以及 CLI 与独立 Node 分发；具体文件以 `src/` 和 `tests/` 为准。`run.ts` 和 `checks/card-and-query-contract.ts` 分别是人工回归与 Gate 聚合入口；fixture 与聚合容器不登记为 Case。

```sh
bun run test:novel-cards-cli
bun run sync:novel-cards-cli
bun run check:novel-cards-cli
```

同步适配 `scripts/build/novel-cards.ts` 将公开 TS 入口和所需模块写入 skill 包。仓库维护修改本目录源码后再同步；安装者可直接修改包内 TS，无需构建，但同路径更新会覆盖定制。公开入口无稳定 SDK 承诺，模块 import 不进入 CLI 或写入；运行前置见 [Skill](../../skills/novel-cards/SKILL.md#工具运行前置)。测试临时目录由测试创建并在结束清理。
