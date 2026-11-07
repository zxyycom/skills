---
title: "Rust 记录工具通用库职责普查"
id: "261107-rust-record-library-replacement-survey"
formedAt: "2026-11-07T10:14:39Z"
question: "Rust 记录候选中哪些职责值得交给库，哪些应保留领域实现？"
tags:
  - "dependencies"
  - "record-cli"
  - "rust"
relations: []
---

## 形成时背景

2026-11-07 最初在 `4f15106afc1eb517c65e595eccfe96b991d0b916` 定向调查记录 CLI Rust 候选。此前不能据定向阅读判断整个代码库：同轮稍后追加完整源码普查，以下结论以补充基线为准，而非声称最初即已取得全量证据。候选不是生产 TypeScript 入口；既有 JSON、错误通道和实际部分写事实是选择边界，TS 偶然实现不自动成为产品要求。

## 调查目的

逐文件判断现有通用原语、可替换候选和保留原因；仅在能指出具体重复或依赖责任时建议调整，不按流行度选库。无须新增依赖的实现改进及具体行为问题见[惯用实现普查](./261107-rust-record-idiomatic-implementation-review.md)。

## 调查范围与依据

补充普查以 2026-11-07 10:55 UTC 所采集 commit `e03e9e87e937029c3058456cfb88d600e1f88ed7`、`tools/record-cli` tree `1070e4a0527f3884f7707922924824abacb33456` 为基线。五个 gpt-6.1-terra 代理按分区分别全文阅读 `tools/record-cli/src` 的 249 个和 `tests` 的 31 个受版本控制 Rust 文件，共 280 个、38,815 行及 17 个关联清单、互操作或 CI 输入；不包括生成 target 与归档报告资源。逐文件记录责任、SHA-256、完整行范围、库和 Rust 判断与关联发现；另一名 gpt-6.1-terra 独立 reviewer 逐项核实 13 项线索及抽样，机械核对路径、哈希和行范围闭合。机械闭合不证明逐行阅读真实性或没有遗漏；独立复核未重读全部文件。源码路径除明确写仓库路径外均相对 `tools/record-cli/src/`，行号指该补充基线。

账本中的 retain 仅表示本轮未发现应库化或惯用化的调整，不证明行为正确或测试通过 Test Design 准入；外部与内嵌测试属于源码普查，并非逐测试入口价值审计，本轮不修改测试或 Case。按静态事实、建议和待验证候选分级；本轮未安装 crate、编译替代、动态测试或性能采样。官方文档能力不证明本仓版本、协议等价或净收益。需要逐文件核对责任、覆盖范围和判断时读 `source-census.json`；需要核对 13 项发现的位置、建议、验证要求及独立复核时读 `findings.json`。两者是同轮普查与复核记录，不是动态验证结果。

## 调查结果与边界

本轮 13 条线索中，8 项建议修改、5 项是待验证候选；本篇覆盖其中 1 项依赖归属修改和 2 项库比较候选，其余 7 项修改和 3 项候选见[实现普查](./261107-rust-record-idiomatic-implementation-review.md)。这些修改建议包含维护性与测试条件，不全是产品 bug；候选不等于应实施。**目前没有建议立即替换或新增通用库**：唯一的依赖修改是调整现有 libc 的直接依赖归属，clap 和 petgraph 均仅供条件成熟时比较。

### 应改：直接依赖归属（INFRA-001）

`tools/record-cli/Cargo.toml:16` 将 libc 声明为普通依赖，而 `tools/record-cli/tests/cli_entry.rs:160-165`、`tests/decision_authoring/publication.rs`、`tests/investigation_identity/cli_resources.rs` 的 Unix 故障注入才直接使用它；生产源码未发现直接引用。建议移到 Unix 条件 dev-dependencies，保留生产使用的 tempfile；[Cargo 开发依赖](https://doc.rust-lang.org/cargo/reference/specifying-dependencies.html#development-dependencies)和[平台依赖](https://doc.rust-lang.org/cargo/reference/specifying-dependencies.html#platform-specific-dependencies)提供声明方式。这不保证传递依赖消失或性能改善。实施后应核对 lockfile、Unix 全 target 测试、Linux release 及 Windows 构建/smoke；目前均未执行。

### 候选：CLI 通用参数机制（CLI-001）

`cli/arguments/mutation/arguments.rs:3-65` 与 `cli/arguments/query/arguments.rs:36-91` 各自实现长选项、值和标志处理，`cli/help.rs:43-115` 另维护帮助；两域 publish/discard 帮助与实际解析已经漂移。应先修正帮助，而非等待换库。可比较内部单表与 [clap 4.6.7 Command](https://docs.rs/clap/4.6.7/clap/struct.Command.html)、[ArgMatches](https://docs.rs/clap/4.6.7/clap/struct.ArgMatches.html)：非退出解析和参数位置能力可供对照，但未证明满足事件顺序。比较须覆盖两域命令、非 Unicode、重复及未知选项、inline 值、source/relation 交错、help/version、错误文本、JSON 通道、退出码和依赖/构建净成本；未达到等价与净收益前不建议引入。

### 候选：图库原语，不立即引入（MODEL-002）

`domains/graph.rs:47-77` 使用非递归 Kahn 验环；[petgraph 0.8.3 toposort](https://docs.rs/petgraph/0.8.3/petgraph/algo/fn.toposort.html) 也提供迭代拓扑排序和环错误，可承担部分通用原语。图索引适配、存储、领域事件预算与稳定顺序的净成本未比较；只在出现其他图原语复用需要时对照，覆盖自环、长链、分支及两域 trace，当前不建议加依赖。

### 保留及理由

- YAML、源文本与 Unicode：`domains/decision/flow.rs` 使用 yaml-rust2 scanner 定位局部 token，重解析保护未选内容；`queries/matcher.rs` 已用 Unicode 库规范化并映射回原始 UTF-16 范围。通用解析和规范化已委托，但字节保真与范围映射的等价替代未证实。`index.rs` 的孤立代理项、JS 键序与重复键处理也不能凭 DTO 假定等价。
- 安全读取与事务：`source.rs` 使用 cap-std/cap-fs-ext 承接相对能力和 no-follow，`transaction/filesystem.rs` 使用 tempfile 和标准文件操作；`git/command.rs` 调用系统 Git，`git/publish.rs` 交 Git 管锁。更换库需证明路径与失败语义、未选暂存及真实部分结果，不假称跨阶段隔离、回滚或 CAS。
- 图和领域操作：标准集合承担映射、排序和去重；本地还协调事件预算、选集、历史与资源 owner。领域责任不是拒绝库的理由：上面的 toposort 仍是可比原语，只是目前净成本未知。

原定向报告将 thiserror 和输出 DTO 列为中等优先试点；全量普查未发现能证明其净收益或紧迫性的跨文件证据，撤回优先级，保留现有 Serde 和错误表达；Debug 字符串的协议风险仅在后续具体错误族需求及 owner 确认下评估，不普遍改写。本轮未实施、未验证平台和性能；源码阅读不证明全部行为正确，也不代表正式发布。

## 随附资源

- [发现与独立复核目录](./_resources/261107-rust-record-library-replacement-survey/findings.json)
- [逐文件普查与关联输入账本](./_resources/261107-rust-record-library-replacement-survey/source-census.json)
