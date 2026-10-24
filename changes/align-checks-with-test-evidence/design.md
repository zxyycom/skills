# Design

先恢复每项证明责任与真实边界，再整改测试、接入及输入证明，以逐项处置和实际验收兑现 proposal。

## Context

- 计划准备时 HEAD 为 `ac40e50c165aa13a8c3cdc11f817141960f0b584`。审计汇总与独立复核对应更早的 `f381715c0bfddd015503544c0fe38e8889809600`；实施必须回读当前目标，不能把旧行号、数量或源码候选闭包当现行事实。
- 当前审计输入为 `.log/vibe-check/audits/test-design-census-20261024-wx9KzT/` 下 summary、A–F report/tests/checks 及 review-checks、review-tests；它们是本 Change 的临时静态材料，详见 findings。未运行测试的审计结论不代表生产缺陷已复现。
- 已用公开 `change-plan list/show` 核对既有计划；任务图显式 ID、SDK 与搁置的纠正方案有独立 Outcome，不在本计划中实施、刷新或结项。
- 稳定规则来自 `docs/navigation.md` 路由到的行为 owner、`docs/tooling.md`、`docs/gate-check-authoring.md`、`docs/coding-style.md`、Test Design 与 Test Evidence Review；本文件只承接当前取舍和交接。
- 当前他会话 investigation candidate 及 `_resources/` 工作不属本 Change；并行写入先明确文件所有权，统一 catalog／Case index／最终门禁由整合者维护。

## Goals / Non-Goals

目标：恢复独立、可选择、可归因的测试证明；补完整输入／成功前置；减少已证重复和无关边界；同步证据、文档和实际交付验收。

非目标：不重造 Gate／调度／依赖推断框架，不要求固定 Check 数或测试数，不扩大 quick eligible，不放宽质量／安全／性能政策，不为旧测试增加未选正文读取或 canonical 硬门槛，不把 POSIX 工具风险扩成全仓环境资格，不调用真实外部业务服务来替代隔离测试。

## Decisions

### Intended Change

1. **先闭合责任。** 对 RC1–RC7 逐一记录最终 consumer：environment 的生成短命令 smoke、双域生成 worker、IR CLI 加载、typecheck program、validator、Test Evidence 分发入口与 LJ 生成 SQL。迁移到已有适当责任与在原处补订阅／provider 都可；实现者选择维护面更小且不丢观察的方案。typecheck 独立建模其程序输入，不连带扩大 formatter。
2. **按独立失败 owner 调整结构。** 显示名先匹配实责；只在责任真的变化时拆合 Check／最小测试节点，并同步重跑命令、输入和 Case。共同十项事务测试及其他无领域 adapter 的共同 reader／verification 归共同 owner，领域 adapter 各留一份；共享 helper 不是自动去重依据。
3. **输入裁剪须有消费证据。** 区分公共运行时加载、独立测试／fixture 和分发消费，优先在既有能力模型中表达。不按静态 sourceFiles 自动生成依赖。gate-tests 可裁剪未读取 helper 字节，但仍保留 catalog 对 leaf 的存在／可访问事实；现模型无法更细表达时允许保守触发，不为去掉每次重跑创建身份缓存。
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
- 输入越细维护成本越高，漏输入风险大于省跑收益；无法证明的闭包保守保留。lint type-aware 单列核对，不能套用 typecheck 推断。
- 原生密钥容量大规模建议先查锁定版本契约／兼容风险，再保留小型项目消费证据；生产上限不变。256 MiB blob、分页阈值、深链栈、真实安装等有 owner 依据的规模不机械删除。
- mode 重叠测试方向相反，只有双向错误模型、完整 index bytes、零写和范围外保护都已在保留后继时才可合并，否则保留两项。
- Git commit hook 可自动 push；用户已授权当前任务必要提交与该 hook 行为，但不覆盖手工 push、外部保护配置写入或真实服务调用。远端访问／执行环境不足时保留明确未完成项。

## Open Questions

以下是实施内待核，不改变已授权 Outcome，也不应阻止先整改已确认项：

- 当前锁定 Oxlint 的 type-aware 实际程序读取闭包；取得精确证据后补输入或记录无需扩展，不能先宣称安全或遗漏。
- secret detector 精确版本的容量公开契约／具体兼容风险，以及能否用项目预算与小型消费保留责任。
- auto-push CAS 与 MCPShell symlink 是否有可复用稳定阶段 seam；没有时收窄 Case 并清楚说明仍未证明目标交错。
- 收窄 gate-tests 是否可沿现有模型表达 leaf 身份；不能时保留必要宽输入。
- 远端当前 `package`／`video-windows` 身份、可获得的同 revision 运行及保护证据；不擅自修改远端配置。
