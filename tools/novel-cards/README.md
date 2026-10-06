# Novel Cards 本地工具

行为与输入输出 owner 是 [卡片契约](../../skills/novel-cards/references/card-contract.md)。本目录只维护解析、文件扫描、图校验、索引集成、查询与 CLI 源码及原生测试；使用现有 Index Runtime，不改变共享协议。

## 源码职责

| 文件 | 职责 |
| --- | --- |
| `src/card.ts` | 卡片字段、正文受管引用解析与领域引用检查 |
| `src/source.ts` | 真实文件扫描与来源指纹 |
| `src/index.ts` | 派生索引与实际来源核对 |
| `src/query.ts` | 精确读取和 `children` 展开预算 |
| `src/options.ts` | 命令参数校验 |
| `src/cli.ts` | 调用及结果映射 |

## 验证与构建

`tests/cards.test.ts` 验证领域解析与图约束，`source-index.test.ts` 验证来源安全、预算与索引当前性，`query.test.ts` 验证精确读取与有界展开，`cli.test.ts` 验证源码参数/输出映射及独立 Node 分发。`test-support.ts` 只承接隔离项目生命周期与源码 CLI 输出捕获，`run.ts` 与 `checks/card-and-query-contract.ts` 分别作为人工工具回归和 Gate 的聚合入口；fixture 与聚合容器不登记为 Case。

```sh
bun run test:novel-cards-cli
bun run sync:novel-cards-cli
bun run check:novel-cards-cli
```

构建适配 `scripts/build/novel-cards.ts` 生成 skill 包内 MJS 和 linked source map。生成物不手工编辑，无稳定 SDK 承诺；模块 import 不进入 CLI 或写入。测试临时目录由测试创建并在结束清理。
