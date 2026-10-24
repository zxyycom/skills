# Design

先恢复每项证明责任与真实边界，再整改测试、接入及输入证明，以逐项处置和实际验收兑现 proposal。

## Context

- 计划准备时 HEAD 为 `ac40e50c165aa13a8c3cdc11f817141960f0b584`。审计汇总与独立复核对应更早的 `f381715c0bfddd015503544c0fe38e8889809600`；实施必须回读当前目标，不能把旧行号、数量或源码候选闭包当现行事实。
- 当前审计输入为 `.log/vibe-check/audits/test-design-census-20261024-wx9KzT/` 下 summary、A–F report/tests/checks 及 review-checks、review-tests；它们是本 Change 的临时静态材料，详见 findings。未运行测试的审计结论不代表生产缺陷已复现。
- 已用公开 `change-plan list/show` 核对既有计划；任务图显式 ID、SDK 与搁置的纠正方案有独立 Outcome，不在本计划中实施、刷新或结项。
- 稳定规则来自 `docs/navigation.md` 路由到的行为 owner、`docs/tooling.md`、`docs/gate-check-authoring.md`、`docs/coding-style.md`、Test Design 与 Test Evidence Review；本文件只承接当前取舍和交接。
- 另一会话的 DR/Index Runtime 产品源码、生成物、11 个新 Case 及调查记录不属本 Change；用户已确认该会话暂停。共享 index 由当前整合窗口维护，最终暂存须按本 Change 归属隔离，不能用整文件暂存混入他方工作。

## Goals / Non-Goals

目标：恢复独立、可选择、可归因的测试证明；补完整输入／成功前置；减少已证重复和无关边界；同步证据、文档和实际交付验收。

非目标：不重造 Gate／调度／依赖推断框架，不要求固定 Check 数或测试数，不扩大 quick eligible，不放宽质量／安全／性能政策，不为旧测试增加未选正文读取或 canonical 硬门槛，不把 POSIX 工具风险扩成全仓环境资格，不调用真实外部业务服务来替代隔离测试。

## Decisions

### Intended Change

1. **按实际消费闭合责任。** 已选方案：CP 生成短命令迁 public-distribution；共同 reader/事务/双域 worker 建共同 Check；IR 三个 CLI 加载叶子归 cli-contract；validator、TE public-boundary、LJ SQL consumer 补统一生成 provider。typecheck/lint 保守订阅 `typescript-program`（含 skill TS/MTS/manifests），只证当前程序质量、不证生成一致性，quick 不增加 provider，formatter 独立范围不变。
2. **按独立失败 owner 调整结构。** 显示名先匹配实责；只在责任真的变化时拆合 Check／最小测试节点，并同步重跑命令、输入和 Case。共同十项事务测试及其他无领域 adapter 的共同 reader／verification 归共同 owner，领域 adapter 各留一份；共享 helper 不是自动去重依据。
3. **输入裁剪须有消费证据。** 区分公共运行时加载、独立测试／fixture 和分发消费，优先在既有能力模型中表达。不按静态 sourceFiles 自动生成依赖。gate-tests 已裁剪未读取 helper/fixture 字节，leaf 字节继续保守覆盖存在、可访问与删除事实；现模型未独立表达纯 leaf 身份，不新增身份缓存。
4. **补强辨错而不改变产品。** 无效 ID key、默认 content 同错、跨行准入、图片拒绝、恢复 bytes、hash、故障命中、只读 `--check`、publisher 停止及 CLI native durations 使用独立预期和外层观察。formalDrift 删除失效拒绝承诺或改成符合 owner 的成功场景；selected candidate/index 保护保留。CAS／symlink 注入优先有界事件；没有稳定 seam 时准确收窄承诺，显式保留证据边界，不通过大输入假造交错。
5. **轻量化以责任连续为准。** 参数／shape 矩阵用已有轻量入口，保留代表性真实分发 Node；路径／已 mock Git 规则不建仓。只去掉无公开契约的私有声明名单／export 写法锁。工作量责任仍以 owner 为准，替换 Map.keys、relations.map、Date.parse、Array iterator 等实现探针时保留稳定解析／验证／资源观察；不能把精确总进程数当安全协议。
6. **局部资源有生命周期。** 实际 fixture 环境隔离，临时目录可回收，等待有局部上界，失败 finally 释放屏障并等待 child／事务结算。保留必要真实 umask、Git、worker、锁、Node 模块解析和 frozen 安装证明。

### Resulting Impacts

| 影响 | 处理与验收 |
| --- | --- |
| 证明契约改变 | 同步输入含义版本、订阅／provider、catalog fixture；检查相关／不相关修改、删除／rename、ignored、失败和起止漂移，不复用旧契约成功证明。 |
| 测试入口重组 | 先列保留后继，再迁移／拆合；runner 实际选择与报告；Case 按意图连续性维护，最终采集实体、同步 index 并做引用／覆盖检查。 |
| 生成与 skill 版本 | 改源码 owner 后运行受影响 `sync:*`／`check:*`；版本承载变化逐 skill 提升。纯生成一致性与行为测试不是重复结果。 |
| 长期 owner 更新 | tooling 承接现行 catalog／执行／CI事实，authoring 承接接入方法，局部契约保留领域责任；达到长期维护契约门槛才写 decision。 |
| 新增 image/video 交付 | 完整 Definition 必须保留当前新增责任；Linux 全 release 与 Windows 视频源码及同次 zip 验收均实际执行，不能路径过滤成功跳过。 |
| 交接与最终质量 | findings 记录处置和证据；阶段仅做正确性复核，最终集中做 AI-ready 文档与编码规范优化，再重跑受影响验证。 |

## Risks / Trade-offs

- 审计多为静态证据。先核当前源码再选择最小方案；未取得运行结果不得勾完成，目标变异只在隔离且有辨错收益时实施。
- 移动测试可能扩大 barrel 顶层加载、漏聚合入口或重复注册；必须同时核包装入口、最终最小实体和能力闭包。
- 输入越细维护成本越高，漏输入风险大于省跑收益；无法证明的闭包保守保留。lint type-aware 的原生读取 trace 未闭合，保持保守程序输入，不把接线回归当成读取 trace。
- 原生密钥保留独立项目容量政策与小型消费证据，不重测上游超容量；生产上限不变。256 MiB blob、分页阈值、深链栈、真实安装等有 owner 依据的规模不机械删除。
- mode 重叠测试方向相反，只有双向错误模型、完整 index bytes、零写和范围外保护都已在保留后继时才可合并，否则保留两项。
- Git commit hook 可自动 push；用户已授权当前任务必要提交与该 hook 行为，但不覆盖手工 push、外部保护配置写入或真实服务调用。远端访问／执行环境不足时保留明确未完成项。

## Open Questions

实施取舍已收敛，没有等待用户选择的领域方案。剩余是验收与外部配置证据：

1. 当前精确隔离tree已取得typecheck、Case1680、test:check、changed与quick证据；同snapshot Linux冷release69/69及版本授权/打包已通过，最终相关revision的远端package/Windows同次zip及最终交付仍待完成，见[验证记录](verification.md)。
2. 远端 main 当前无 branch protection、rulesets 为空；既有 workflow 发布依赖仍保留，但远端合并阻断尚未证明生效。需要配置时取得明确授权，不以本地测试代替。

## Implementation Observations

- 当前 Definition 69 项（environment 1、native 8、package 20、semantic 37、release 3），base 66、receipt-managed 58；quick 原 10 项与 total/P90/mean 的严格预算保持不变，其他 scope report-only。输入契约为 `project-tool-receipts-v7`，调度 identity 为 `gate-native-command-v5`，learned 策略及硬资源不变。
- 原待核边界已定：lint 无完整原生读取 trace，采用充分程序输入；secret 保留项目限额与小型消费、不复测上游超容量；auto-push 没有稳定 CAS seam，准确保留有限证明；MCPShell 用既有 wc seam 确定命中；leaf 身份采用保守字节覆盖。
- 阶段独立复核发现的 G1–G3 已闭合。新增 TE 项目能力只由三项项目 Check 订阅；DR strict-preparation 与当前 record consumer 的实际源码 CLI 闭包补齐（另一会话 frontmatter leaf 未迁移）；environment 补源码 validator，无生成前置。
- 阶段目标运行、首次失败、节点后继与静态复核见 [findings](findings.md) 及其 handoff/review 路由；后续修复后公开实体采集与 Case/index 引用覆盖已取得 complete/1691 和通过；这是混合工作区，不代表全部测试已运行，也不代替排除他方工作后的提交快照验收。最终整合与 Gate 继续由 tasks 跟踪。
- 长期 owner 同步限于 tooling 的当前运行事实与 authoring 的接入方法。共同 Check、源码 CLI 与生成信任边界执行既有责任契约，未达到另记长期决策的门槛；未改 Decision 或无关 README。
- 首次隔离 changed 的指标失败按独立意图拆分，人工 run 输入新增两个精准 catalog 能力，只由真实 test:check/Case catalog 消费者订阅；27目标通过及九文件原生指标零finding见[Gate交接](gate-handoff.md)。依赖软链接引起的权限/输入问题仅修复验收环境；当前本方精确快照已通过本地变更验收，69/66/58、quick10和政策均不变。
