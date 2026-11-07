---
title: "Rust 记录工具实现与语法普查"
id: "261107-rust-record-idiomatic-implementation-review"
formedAt: "2026-11-07T10:14:40Z"
question: "Rust 记录候选中哪些内部表达值得惯用化而不改变对外契约？"
tags:
  - "maintainability"
  - "record-cli"
  - "rust"
relations: []
---

## 形成时背景

最初于 2026-11-07 10:14 UTC 在 `4f15106afc1eb517c65e595eccfe96b991d0b916` 定向审阅 Rust record CLI 候选；同轮随后补做源码普查，纠正不能从热点外推全仓的缺口。Rust 是候选而非生产 TS 入口；批准的 JSON、通道和实际部分写事实不能因语法改写静默改变。

## 调查目的

从完整源码识别无需新库的明确改进，区分静态可建议修改与依赖契约或替代验证的候选，并说明应保留的结构；库和依赖取舍见[通用库职责普查](./261107-rust-record-library-replacement-survey.md)。

## 调查范围与依据

2026-11-07 10:55 UTC 采集 commit `e03e9e87e937029c3058456cfb88d600e1f88ed7`，覆盖 `tools/record-cli/src` 和 `tests` 全部 280 个受版本控制 Rust 文件、38,815 行，另阅 17 个关联输入；五名 gpt-6.1-terra 按分区逐文件全文阅读（249 个 src、31 个 tests），记录 SHA、完整范围和两类判断；另一名 gpt-6.1-terra 独立 reviewer 逐项核实 13 项线索及抽样，路径/哈希/范围机械闭合，但机械检查不证明逐行阅读真实性或零遗漏。本报告共享库职责普查拥有的两份资源：逐文件范围、责任和判断见 `source-census.json`，13 项发现、验证要求及独立复核见 `findings.json`；它们是静态普查记录，不是动态验证结果。账本的 retain 仅表示本轮未发现应库化或惯用化的调整，不证明行为正确或测试通过 Test Design 准入；外部与内嵌测试列入源码普查，但不构成逐入口测试价值审计，本轮不修改测试或 Case。源码路径除明确仓库路径外均相对 `tools/record-cli/src/`，行号属于此补充基线。未运行测试、构建替代或采样。

## 调查结果与边界

本轮 13 条线索分为 8 项建议修改和 5 项待验证候选；本篇覆盖 7 项行为、测试及实现修改和 3 项候选，另外 1 项依赖修改与 2 项库候选见[库职责普查](./261107-rust-record-library-replacement-survey.md)。建议修改不全是产品 bug；候选不等于应实施。

### 应改：用户可见错误和测试条件

1. **CLI-002**：`cli/help.rs:50-52,75-79` 对两域共享 discard/publish 帮助，但 `cli/arguments/mutation/decision.rs:73-91` 只接受单 selector 且 publish 必需 alignment；`cli/arguments/mutation/investigation.rs:42-61` 允许多 selector、拒绝 alignment 与 keep-unrecorded-history，而 DR discard 不接受 delete-owned-resources。应分域修正帮助，不改变现有语法；验证两域 help 与正反例。
2. **CLI-003**：`cli/mutation/decision/services.rs:70-76,87-94` 的 selected 失败上下文硬编码索引 basename，失败 JSON 的 indexRelativePath 因而不指实际配置路径；应复用已验证的实际工作区相对路径，比较默认及自定义目录的成功、预检和执行失败。
3. **CLI-004**：`tools/record-cli/tests/queries/candidates.rs:237-265` 仅 symlink 创建受 Unix 条件限制，后续却无条件断言专属诊断。建议整个测试函数使用 `cfg(unix)`，在 Unix 运行该节点并核对非 Unix 编译。此为测试 fixture 条件不一致，**不是**已证明 Windows 产品失败或现有 CI 失败；Windows 当前承诺 release 构建与 smoke，不由此扩大到全套测试。

### 应改：复用现有规则和显式成功值

- **AUTHOR-003**：`mutations/candidate.rs:36-43`、`mutations/decision/lifecycle/rules.rs:182-188` 与 `domains/mod.rs:60-68` 的 kebab 判定等义；调用已有 `is_kebab`，保留路径和错误语义，验证空值、连字符、ASCII、非 ASCII 和迁移。
- **OPS-003**：`mutations/investigation_relations.rs:230-239` 的 ECMAScript whitespace 字符表与 `domains/mod.rs:46-58` 的 `JsTrim` 相同；复用后保留对原始值的 CR/LF 检查及修剪后长度限制，不能换成 Rust 默认 trim。验证 BOM、换行和非 ASCII 空白。
- **OPS-002**：`mutations/sync/selected_sync.rs:47-84,250-263` 将校验结果经可变 Option 副作用取回，再用 `unreachable` 表达必然有值；让回调返回 `Result<V, E>` 或在投影后直接返回已验证索引更能表达成功值。现有调用成功前恰执行回调一次，**不是已证明可触发 panic**；保留成功前验证、错误映射和排序。
- **OPS-001**：`mutations/investigation_operation.rs:37-61` 与 `mutations/investigation_relations/transaction.rs:13-17,44-74` 在一次准备中两次捕获解析基线，选择与写集来自两次观察。建议传递同一快照，保留第二路径承担的图验证、selector/review 相关失败顺序和独立调用入口；预检与正式执行仍各自准备。覆盖预检、无变更、写入和读取失败，不新增 fresh、CAS、回滚或跨文件隔离承诺。

### 候选：先确认契约或比较

- **MODEL-001**：`queries/investigation/show.rs:23-28` 在身份提取前剥 BOM，`queries/investigation/content.rs:49-58` 则不剥，`domains/investigation/document.rs:217-229` 要求首行 `---`。已发布索引下当前源加 BOM 会形成身份核验差异；固定正式报告要求 frontmatter 首行开始，不能据宽容 show 断言 BOM 是合法正式来源。先由 owner 明确只读兼容边界，再用私有 fixture 核对 show/content、stale 与严格 check，不预设放宽解析。
- **AUTHOR-002**：`mutations/check/selected.rs:226-279` 回退身份发现时完整捕获并解码所有合格成员；即使未选正文无效也可能阻断。owner 允许必要扩大身份发现，但未明确此情况下非法未选正文的处置。先确认契约，再比较 `capture_header` 与完整读取，验证编码、重复身份、不安全成员和再次捕获一致性。
- **AUTHOR-001**：`mutations/authoring/render.rs:187-205` 将泛型关系序列化为 Value 后两次 unwrap；现有两种关系枚举不构成已发生 panic 的证据。可比较穷尽转换与已有命名规则复用，避免引入另一份会漂移的名称映射。

### 保留及理由

`mutations/sync/selected_sync.rs` 克隆基线隔离候选；`domains/graph.rs` 的双向索引与非递归验环支持深图；`queries/matcher.rs` 维护规范化后到原文 UTF-16 的范围。选择顺序、事务阶段和实际写入事实均有用途，不机械消除 clone、换组合子或合并两类 argv 数据结构。原定向报告把 Debug 对外映射和输出 DTO 列为优先试点；本次未发现证明其相对以上具体问题更迫切、或 DTO 有净收益的证据，撤回优先级，按具体协议需求再评估。所有建议为静态判断；没有实施、运行测试或验证平台、性能和全行为正确性。

## 随附资源

- [发现与独立复核目录](./_resources/261107-rust-record-library-replacement-survey/findings.json)
- [逐文件普查与关联输入账本](./_resources/261107-rust-record-library-replacement-survey/source-census.json)
