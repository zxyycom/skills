---
title: "Rust 记录工具惯用实现审阅"
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

2026-11-07 审阅 `4f15106afc1eb517c65e595eccfe96b991d0b916` 的 Rust record CLI 候选。它不是生产 TS 入口，也不是纯机械翻译：已用类型化结果、Serde、能力目录、Unicode 与临时文件库。批准的 JSON、错误通道和实际部分写事实不能因语法改写静默改变；旧 TS 的偶然实现也不自动成为新增产品契约。

## 调查目的

识别不依赖换库即可减少内部表达负担的局部选择，区分可试点、保留和尚无收益证据；不实施改动或宣称已验证替代。通用库的职责取舍见[库替换调查](./261107-rust-record-library-replacement-survey.md)。

## 调查范围与依据

按基线定向阅读 `cli/arguments/{query,mutation}/arguments.rs`、`cli/output/{identity,transaction}.rs`、`cli/output/transaction/stage.rs`、`mutations/sync/selected_sync.rs`、`mutations/decision/{history,lifecycle/operation/archive}.rs`、`domains/graph.rs`、`queries/matcher.rs` 与 `source_revision.rs`。本文源码路径和行号相对 `tools/record-cli/src/`；这是代表性审阅，不是全部文件或全部行为的审计。

## 调查结果与边界

优先试点外部错误映射，其次试点局部输出 DTO；clone 仅按实际所有权关系处理。已承载语义的集合、顺序和领域流程是保留项，不是待重写清单。以下建议均不要求新增依赖。

### 优先试点：错误映射

**明确错误到外部消息的映射，而非依赖 Debug（高）**。`cli/output/transaction/stage.rs:87-101` 将 `IndexStageError` 的 `Debug` 格式直接作为 JSON message；`mutations/decision/lifecycle/operation/archive.rs:108-118,145` 和 `mutations/sync/selected_sync.rs:135` 也把 Debug 放进跨边界失败。变更内部枚举名称或字段可能连带改变外部文字，且原因和定位易被埋在调试表示中。先在一个错误族增加显式穷尽映射或 Display，保留 code、recovery、已批准消息和部分写状态；比较成功、各失败分支、stdout/stderr、退出码及实际部分写结果。收益是将内部演进与公开协议解耦；现有协议是否要求逐字兼容需按行为 owner 判断，不能把现有字符串一律视为新规范。

### 局部输出 DTO

**先试点：对稳定输出使用局部 Serialize DTO（中）**。`cli/output/identity.rs:152-157` 先构造 `Value` 再复制 `id` 到 `decisionId` 并条件插字段；`cli/output/transaction/stage.rs:52-74` 按领域追加不同字段。局部具名结构和可选字段可以让必要字段、缺省和分支可在编译期看见，减少动态回读，但不必把全部 JSON 宏替换，也不应为每个一次性对象设计泛型层。试一个输出并比对数组顺序、可选字段存在/缺失与 null/false、文本与 JSON、错误分支，以及索引 fingerprint 规范化精确字节；对象键或序列化字节顺序仅在 owner 明确要求时验证。`preserve_order` 影响 Value 对象 map，不统管 DTO 字段顺序；无同等证据前保留 Value。收益为结构可读与误拼字段的风险降低，并非性能结论。

### 按所有权判断 clone

**只按所有权关系消除实际多余 clone（低）**。`cli/output/identity.rs:154` 从刚生成的 Value 回读克隆是上项试点的明确候选；`mutations/sync/selected_sync.rs:56-76` 克隆 baseline 后构造待验证完整投影，则让可信基线不受失败中的候选变动影响，是清晰的隔离边界，不应机械删除。`domains/graph.rs:24-36` 的边复制服务双向索引；使用共享引用或 arena 将增加生命周期和维护成本，目前无净收益证据。只有消费方可自然转移所有权且简化代码时用 `into_iter`/借用，验证结果及顺序，勿为避免 clone 引入复杂生命周期、泛型或 trait。

### 保留：数据结构与顺序

**保留已表达语义的数据结构与顺序**。`mutations/sync/selected_sync.rs:13-46,77-79` 的 BTreeMap/BTreeSet 与显式 UTF-16 排序、`domains/graph.rs:45-75` 的非递归 Kahn 验环分别承担候选投影和深图栈安全；`queries/matcher.rs:123-141` 将规范化匹配映射回原始 UTF-16 范围。集合类型、排序与所有权不是风格替换对象。若后续重构，需覆盖补充平面字符、规范化、图错误和确定顺序；不能仅凭 HashMap、Vec 或 clone 推断问题。

### 保留：领域流程

**保留领域流程，不为语法统一扩大抽象**。两套 argv 扫描相似，但 `cli/arguments/query/arguments.rs:37-55` 用按名称分组的 map，而 `cli/arguments/mutation/arguments.rs:3-31` 保留有序 option 列表；后者的关系事件顺序可能有语义。可在验证后抽取确实相同的局部解析，但不能先合并数据结构。`mutations/decision/history.rs` 与 lifecycle 操作中显式状态和失败路径应由领域契约决定，不以统一 Result 链或组合子代替可读的事务次序。

### 使用边界

本轮没有做性能采样、代码修改、测试或替代实现编译。这些是静态阅读下的维护收益判断，不证明当前行为有 bug，也不证明性能、二进制大小或实现可行性。后续任何实施先确认行为 owner，再按变更覆盖边界、回归和平台验收；本轮无实施、性能或全仓检查证据。
