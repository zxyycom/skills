---
title: "Rust 记录工具通用库职责取舍"
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

2026-11-07 在基线 `4f15106afc1eb517c65e595eccfe96b991d0b916` 调查 Rust 记录 CLI 候选。它仍是候选而非生产 TS 入口；`tools/record-cli/Cargo.toml` 已依赖 serde、serde_json、yaml-rust2、sha2、unicode、time、cap-std 和 tempfile，不能把现状描述为手写一切。现有批准的 JSON、错误通道及实际部分写事实是替换边界，不把 TS 的偶然实现自动提升为产品要求。

## 调查目的

判断哪些通用职责适合交给成熟库或现有依赖，哪些应留在领域代码；给出最小对照、预期维护收益和验证代价，而非按流行度增加依赖。不新增依赖的内部表达选择见[惯用实现审阅](./261107-rust-record-idiomatic-implementation-review.md)。

## 调查范围与依据

定向检查 `tools/record-cli/Cargo.toml`、`cli/arguments/{query,mutation}/arguments.rs`、`cli/help.rs`、`cli/output/`、`{index,source,source_revision}.rs`、`domains/{graph,decision/flow}.rs`、`queries/{matcher,trace/frontier}.rs`、`transaction/filesystem.rs`、`git/{command,publish}.rs` 和 `tools/record-cli/protocol.md`。除明确写出仓库路径的文件外，本文源码路径相对 `tools/record-cli/src/`，行号指该基线；不宣称审完全部源码。2026-11-07 对照下述官方文档；文档能力不是本仓已安装版本、编译可用性或等价替换证明。

## 调查结果与边界

优先对照 CLI 的项目内表驱动方案与库方案；其次分别试点错误、输出结构和图通用原语。YAML、Unicode、哈希、能力目录、临时文件与系统 Git 是建议保留的现有组合，不是高优先级替换待办。以下均为静态建议。

### 优先候选：CLI 声明式入口

**先对照试点，不立即添加依赖。** `cli/arguments/query/arguments.rs:3-29,37-55` 与 `cli/arguments/mutation/arguments.rs:3-31` 分别维护 flags 和扫描；`cli/help.rs` 又有 help 表，命令变化需协调多个位置。先比较项目内单一表驱动方案与 [clap 4.6.7 Command](https://docs.rs/clap/4.6.7/clap/struct.Command.html)：后者提供命令、参数和 help 声明，`try_get_matches` 可把解析错误交回入口；不直接用会自行退出的入口，否则绕过 JSON 错误映射。预期收益是减少重复声明和漂移，净删除量尚未证明。对照须涵盖两域命令、重复和未知选项、空值、位置、事件顺序、help/version、退出码与 JSON stdout/stderr；只在兼容且复杂度净降时考虑引入。clap 默认诊断格式和退出行为不能假定等价。

### 错误语义与 thiserror

**先规范错误语义，再考虑 thiserror（中）。** `source.rs:69-74` 和 `index.rs:38-43` 的 Display 使用 Debug；`cli/output/transaction/stage.rs:87-101` 直接把 Debug 做 message。应先定义各错误的对外映射及 cause，不能依赖内部枚举调试形状。 [thiserror 2.0.21](https://docs.rs/crate/thiserror/2.0.21) 可 derive Error、声明消息和 source，能减少样板，但不设计业务错误码或兼容协议；仅为消除几行 impl 尚无新增依赖的净收益证据。试点须比较 message、code、recovery、通道、退出与实际部分写事实。

### Serde 与输出结构

**继续使用现有 Serde，局部试 DTO（中）。** `cli/output/identity.rs:152-157` 的 Value 动态插字段并从结果回读 clone，具名 Serialize 输出可让字段显式，利用 [Serde 字段属性](https://serde.rs/field-attrs.html) 控制可选字段；`cli/output/transaction/stage.rs:52-74` 的两域差异也可小范围对照。不能把一切 Value 视为坏代码。`index.rs:68-74` 当前有意通过 Value 保持 JSON.parse 风格的重复对象键后者覆盖；改输入解析须对照此行为，是否为已批准外部契约需由 owner 确认，且不同于 YAML 重复键限制。验证数组顺序、可选字段存在/缺失与 null/false、索引 fingerprint 规范化精确字节、成功失败、两域及输出通道；对象键或序列化字节顺序仅在 owner 明确要求时验证，`preserve_order` 影响 Value 对象 map，不统管 DTO 字段顺序；无同等证据前保留现状。

### 保留：YAML、Unicode 和哈希

**保留现有库及领域适配。** `domains/decision/flow.rs:97-125,169-171` 不只解析值，还用 yaml-rust2 scanner 检查流式写法；[yaml-rust2 0.10 scanner](https://docs.rs/yaml-rust2/0.10.4/yaml_rust2/scanner/index.html) 是词法层，不替代 frontmatter 规则。`queries/matcher.rs:123-141` 将 NFKC 转换映射到原始 UTF-16 范围；`domains/graph.rs:80-86` 对图证据按 UTF-16 排序；`source_revision.rs:8-28` 在 SHA-256 外定义域标签、长度、分隔符和不同换行规则。换解析或规范化库不能自动保留这些语义；需要流式/引号、重复键、补充平面字符、规范化映射和精确 fingerprint 字节对照。没有换库收益证据，不建议仅因惯用而替换。

### 保留：能力目录、tempfile 与系统 Git

**保留现有组合。** `transaction/filesystem.rs:57` 已使用同目录 NamedTempFile；`transaction/filesystem.rs:7-18` 在普通操作前 canonicalize 父目录并检查其位于工作区，不能据此推断跨阶段父链证明或竞争安全；安全来源与实际失败结果仍由项目承担。`git/command.rs:10` 调用系统 Git，`git/publish.rs` 实现索引发布；[gix Repository](https://docs.rs/gix/latest/gix/struct.Repository.html) 提供 index 访问，不证明与该操作的锁及事务等价。换库须对照配置、unborn HEAD、路径冲突、Git 自管锁、未选暂存、相同 JSON 合成、真实部分结果和 Windows；不把已删除的跨阶段 proof、备份回滚、CAS 或 readback 机制作为门槛。不能因为纯 Rust 就替换。`libc` 是否只在测试使用可单独核查后考虑移入 dev-dependencies，本轮未修改或证明完整构建矩阵。

### 图库通用原语

**先对照，再决定是否引入（中）。** `domains/graph.rs:10-43,45-75` 同时验证边、建双向索引并用非递归 Kahn 算法验环；`queries/trace/frontier.rs` 负责方向、深度、截断原因与顺序。[petgraph 0.8.3 toposort](https://docs.rs/petgraph/0.8.3/petgraph/algo/fn.toposort.html) 是迭代拓扑排序并在有环时返回错误，可对照现有通用验环；[BFS](https://docs.rs/petgraph/0.8.3/petgraph/visit/struct.Bfs.html) 也可对照可达遍历。领域边校验、ID 映射、稳定排序及事件预算仍由项目承接，这本身不否定库。应比较可删除的通用逻辑与图构建、映射及桥接的净成本，并验证深图、事件、顺序与错误；目前未试点、净收益未证明，暂缓是否引库。

### 使用边界

本轮没有安装新 crate、全量升级、编译替代实现、性能采样或实施代码。推荐是静态取舍而非依赖变更或已通过验收。既有性能、Windows 和事务调查可作背景，但本轮不复查其结论。实际实施需经依赖 owner 选择并以跨平台、协议和恢复验证作决定；没有测得性能或体积收益。
