### Case GATE-DEFINITION-CATALOG-001: 门禁目录构造准确的 default 与 full Definition

Entry:
- `scripts/vibe-check.test.ts > gate catalog builds the exact default and full Definitions`
- `bun test --test-name-pattern="^gate catalog builds the exact default and full Definitions$" ./scripts/vibe-check.test.ts`

Contract:
- 同一能力目录必须构造日常 default 与发布 full；两者共享六项 Vibe 原生 Check，full 只增加 release-only 项目能力和终结 `pack:skills`。

Proves:
- default/full 的 Check ID 分别与目录一致，default 不含 `pack:skills`，full 只在末尾声明它。
- default 有 25 项日常 package-script 能力，full 增加 6 项 release-only 能力；全部 Definition 使用 Vibe 静态并发 4、progress 开启且 machine/diagnostic 输出关闭。
