# Novel Cards 本地工具

字段与历史效力由 [卡片契约](../../skills/novel-cards/references/card-contract.md) 承接，命令、批量输入与恢复由 [CLI 契约](../../skills/novel-cards/references/local-cli.md) 承接。本目录只维护解析、文件扫描、图校验、索引集成、查询、批量变迁事务与 CLI 源码及原生测试；使用现有 Index Runtime，不改变共享协议。

## 源码职责

| 文件 | 职责 |
| --- | --- |
| `src/card.ts` | 卡片字段、身份/版本与正文受管引用解析 |
| `src/graph.ts` | 跨卡引用、章节scope、变迁端点与版本组成图校验 |
| `src/source.ts` | 真实文件扫描与来源指纹 |
| `src/index.ts` | 派生索引与实际来源核对 |
| `src/query.ts` | 精确/版本读取、标题/章号候选、自动历史关系和 `children` 展开预算 |
| `src/apply-transition.ts` | 批量输入解析、前后版本计划与隔离集合/索引验证 |
| `src/transaction.ts` | 受控目标预检、journal、原子单文件发布及恢复/回滚 |
| `src/options.ts` | 命令参数校验 |
| `src/cli.ts` | 调用及结果映射 |

## 验证与构建

| 原生测试文件 | 验证职责 |
| --- | --- |
| `tests/cards.test.ts` | 领域解析与图约束 |
| `tests/source-index.test.ts` | 来源安全、预算与索引当前性 |
| `tests/query.test.ts` | 精确读取与有界展开 |
| `tests/chapters.test.ts` | 跨 scope 章号、重名候选与稳定身份 |
| `tests/history.test.ts` | 跨实体完整版本、演进/修订/撤回/预期 |
| `tests/transactions.test.ts` | 跨文件事务失败、恢复路径与完整原文字节 |
| `tests/cli.test.ts` | 源码参数/输出映射与独立 Node 分发 |

`history-support.ts` 承接历史与事务测试共用的变迁 fixture，`test-support.ts` 承接隔离项目生命周期与源码 CLI 输出捕获。`run.ts` 与 `checks/card-and-query-contract.ts` 分别作为人工回归和 Gate 的聚合入口；fixture 与聚合容器不登记为 Case。

```sh
bun run test:novel-cards-cli
bun run sync:novel-cards-cli
bun run check:novel-cards-cli
```

构建适配 `scripts/build/novel-cards.ts` 生成 skill 包内 MJS 和 linked source map。生成物不手工编辑，无稳定 SDK 承诺；模块 import 不进入 CLI 或写入。测试临时目录由测试创建并在结束清理。
