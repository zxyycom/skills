# Design

在现有 Gate 与 receipt 事务内补齐真实输入归属和回退反馈，以同机证据决定是否收窄现有触发范围。

## Context

- 运行、完整 catalog、receipt 与 CI/release 行为由 [项目工具链](../../docs/tooling.md#权威-vibe-门禁)拥有；接入方法由 [Gate Check 编写与接入](../../docs/gate-check-authoring.md)拥有。
- 当前基线为 `ab3ffba6138122053cf944bc4acc45b2db66a28b`；主树含其他任务活跃的领域源码、分发生成物与测试账本，本轮不得将它们当作自己的实现或提交。
- 既有 handoff 与 smoke 位于 `.log/vibe-check/reuse-markdown-lint-receipts-20261021/`。shared 单样本命令总耗时 16.907s、Run 13.9s；unchanged 单样本命令总耗时 6.697s、Run 3.8s。它们仅作为待进一步归因的观察。

## Goals / Non-Goals

目标：让新输入的真实消费闭包可维护、保守回退可行动，并对剩余触发与 Run 外成本逐项得出有证据的处置结论。

非目标：不增加 Gate、runner、cache 或调度抽象；不调整链接检查；不放宽 unknown、symlink、读取失败、漂移或预算保护；不缩小 CI/release 全执行边界；不设硬秒数目标；不接管并行领域实现。

## Decisions

### Intended Change

1. 先核对当前新增领域输入的 wrapper/import 与传递加载闭包，将真实消费者纳入既有能力，不按目录相邻猜测归属。
2. 在现有终端与 machine 输出位置补回退定位：给安全、有界的仓库相对路径及稳定原因，保留保守执行和不发布部分证明的行为。
3. 审查 shared 场景仍执行的检查与 Run 外工作，分开报告命令总耗时、Run 耗时和工作量。只有完整依赖证据与代表性验证均支持时，才收窄已有 patterns 或去重；无法证明安全则保留，并说明必要性或证据缺口。

### Resulting Impacts

1. 能力 patterns 或诊断变化需同步受影响项目测试、catalog 期望和 Test Evidence Case/index；最小原生测试入口仍由账本 owner 管理。
2. 诊断在 [项目工具链](../../docs/tooling.md#运行产物与恢复)最小同步；编写指南只有新增维护义务时补充，避免复制运行契约。路径不得泄露绝对根或敏感原值，数量与消息必须有界。
3. 优化候选必须覆盖受影响/不受影响输入和错误路径；既有删除/重命名、ignored 输入、共享 flag、成功前置与漂移保护继续成立。CI/release 不读写 receipt，链接仍实际执行。
4. 最终提交需隔离本任务文件或 hunks，保留其他任务工作；稳定规则、临时证据和 Change 进度分别归其 owner。

## Risks / Trade-offs

- 当前新增文件仍在并行演进，归属结论以验收时真实 imports 为准；新增未归属输入继续保守回退。
- 诊断可行动性不能换取泄密或无限输出；错误消息不能直接回显未审查的绝对路径与原始异常。
- 热点耗时可能是必要检查或机器竞争，单样本与总耗时差额不足以证明冗余；安全闭包优先于表面加速。
- 本轮预计仅为既有闭包与诊断 UX 维护，不改变长期 owner 或交付契约；若实施发现新的长期取舍，先交主代理评估 Decision Records 门槛。

## Open Questions

无待用户决定的问题。各热点能否安全收窄或去重属于需用证据解答的实施审计项，不预设必须修改。
