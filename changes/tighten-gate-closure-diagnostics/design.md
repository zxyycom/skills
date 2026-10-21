# Design

在现有 Gate 与 receipt 事务内补齐真实输入归属和回退反馈，以同机证据决定是否收窄现有触发范围。

## Context

- 运行、完整 catalog、receipt 与 CI/release 行为由 [项目工具链](../../docs/tooling.md#权威-vibe-门禁)拥有；接入方法由 [Gate Check 编写与接入](../../docs/gate-check-authoring.md)拥有。
- Plan 建立时基线为 `ab3ffba6138122053cf944bc4acc45b2db66a28b`；主树含其他任务活跃的领域源码、分发生成物与测试账本，本轮不得将它们当作自己的实现或提交。
- 历史 smoke 位于 `.log/vibe-check/reuse-markdown-lint-receipts-20261021/`，仅提供初始观察；最终三轮实测与标准入口验证分别记录，不将不同基线、入口或环境的差异当作本轮收益。

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

- 能力归属以验收时真实 imports 为准；新增未归属输入继续保守回退。
- 诊断可行动性不能换取泄密或无限输出；错误消息不能直接回显未审查的绝对路径与原始异常。
- 热点耗时可能是必要检查或机器竞争，单样本与总耗时差额不足以证明冗余；安全闭包优先于表面加速。
- 本轮沿用既有 owner、保守回退与交付契约，仅维护闭包和诊断 UX，未形成需要另立 Decision Record 的长期取舍。

## Open Questions

无。消费审计与同机测量支持保留现有七项消费及前置，任务验收已完成。

## Implementation Observations

- 并行领域会话已在 `04d9c73834214baecabb6034101b27852af28691` 保存领域实现、wrapper 接线、Case 与生成物；这些只作为本轮核对真实 imports 的基线。本轮修改既有能力 patterns，不接管或归功于领域改动。
- 回退信息投影既有 snapshot，使用同一有界诊断对象供终端与 machine 消费；完整字段与恢复路径归 [运行产物与恢复](../../docs/tooling.md#运行产物与恢复)。诊断不参与输入分类、flag 选择、receipt 或退出状态判断。
- 已有 shared 样本的七项 execute 均为 `inputs-changed`，不是错误的共享 flag 或成功前置扩散。源码质量三项、统一生成 provider、账本检查及两个领域 CLI 分发消费者均有真实消费；本轮不收窄其订阅或删除前置。
- 账本 source revision 实际散列 `scripts/`、`tools/`、`skills/` 的源码/JSON；实体采集另有包含 literal dynamic import 的测试加载闭包。只缩 Gate flag 不能改变真实 checker 输入，当前没有安全排除共享 renderer 的证据。
- 统一生成 provider 已共享一次源码 facts；分发源码声明 emit、外部 consumer 编译及真实 Node 启动分别证明不同边界，未证实可删冗余。
- 安全输出修复保持在现有诊断边界：先对原始词边界脱敏，再转义残留控制字符，最终限制到 500 字符；独立正确性审查已闭合控制字符紧邻秘密值的反例并最终 PASS。

## Verification Evidence

本节证据根为 `.log/vibe-check/gate-closure-diagnostics-20261021/`，不随 skill 分发。`implementation/*split*` 记录最终测试拆分后的 `test:check` 85/85、typecheck、lint 和九文件格式检查通过；`review/handoff.md` 记录独立正确性最终 PASS。四个新增 Case 与选择性派生索引已同步，隔离 Gate 账本检查通过 1368 个实体。

### 三轮同机测量

`cost-analysis/isolated-04d9-v1.handoff.md` 与同名 `summary.json` 保存原始证据入口。三轮基于 `04d9c738` 加本任务改动，同一私有 cwd/父进程及真实继承环境，用 ignored Node driver 包裹既有依赖边界；没有更改生产计时接口或伪造 fingerprint。外层墙钟在子进程退出即停止，区别于 Run API 时间：

| 场景 | 外层墙钟 s | Run API s | execute / reuse |
| --- | --- | --- | --- |
| warm | 125.455 | 119.240 | 53 / 0 |
| unchanged | 11.184 | 7.024 | 0 / 53 |
| shared | 16.215 | 13.220 | 7 / 46 |

三轮均 completed/passed、未闭合输入为零、发布 53 项 receipt；后两轮 Markdown 内容复用，links 每轮实际通过。shared 七项均为 `inputs-changed`，消费审计见 `cost-analysis/handoff.md`；没有可安全删除订阅、成功前置或检查的证据。

shared 的 Run 外差额约 2.994s，其中模块加载 0.517s、prepare 1.331s、publish 1.065s；其余包含 Node 启停、摘要与报告写入等。prepare/publish 各执行 11 个并发 probes，span 约 0.762s/0.604s，与其他采样工作重叠，不能相加。结束重采样实际完成漂移复核，不是可删重复。分发 emit、独立 consumer 类型检查与真实 Node 启动分别证明不同边界，也不删减。

三次均为代表性单样本，不证明稳定提速；`04d9c738` 的领域惰性图收益不归本任务。shared 三文件 fixture 的字节和 mode 均已还原，最终非 ignored 文件签名无差异，私有 index 未变。

### 标准入口与适用边界

在 `5c95358b` 加本任务改动的隔离快照执行真实 `bun run check`：exit 0，外层墙钟 64.926s，原生 progress Run 61.7s；64 项中 61 passed、3 项 release 未激活，无 failed/unavailable。53 execute、0 reuse、未闭合计数为零，实际发布 53 项 receipt，Markdown 内容与 links 均实际 passed。证据为 `validation/standard-check-final.log`、`.json`、`standard-check-final-summary.json` 及归档 `standard-check-final-invocation/`。

该标准入口与三轮 driver 的真实入口环境、基线不同，以上结果单列；64.926s 不是 shared 样本，不与 16.215s 比较。本轮未修改 force-full、CI/release 选择及发布路径；最终 85 项回归含 full/CI 对抗，因此不另跑 cold release。最终 AI-ready 代表阅读与编码规范复核通过，隔离改动仅含本任务文档、实现、测试、四个 Case 与派生索引；没有把并行领域或调查候选纳入交付。
