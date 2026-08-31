### Case GATE-DEFINITION-CATALOG-001: 门禁目录构造准确的 default 与 full Definition

Entry:
- `scripts/vibe-check.test.ts > gate catalog builds the exact default and full Definitions`
- `bun test --test-name-pattern="^gate catalog builds the exact default and full Definitions$" ./scripts/vibe-check.test.ts`

Contract:
- 同一能力目录必须构造日常 default 与发布 full；两者共享六项 Vibe 原生 Check。full 额外加入六项 release-only 项目脚本，并在全部普通前置后追加唯一的 `pack:skills` release 终结 Check；未显式指定时，它的 authored baseline 为 `HEAD`。

Proves:
- default/full 的 Check ID 分别与目录一致；default 不含 `pack:skills` 或普通 `script:hash:skills`，full 只在末尾声明终结 Check。
- default 有 24 项日常项目脚本，full 额外有六项 release-only 项目脚本；二者与六项原生 Check 构成 36 个 full 普通前置。全部 Definition 使用 Vibe 静态并发 4、progress 与 machine publication 开启、diagnostic log 关闭。
