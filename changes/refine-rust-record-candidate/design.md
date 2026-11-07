# Design

在顺序本地 Rust 候选现有责任内修正具体行为与数据流，并以目标契约和直接证据验收。

## Context

候选及平台边界见 `tools/record-cli/README.md` 和 `tools/record-cli/protocol.md`；形成时的静态依据见 `docs/investigations/261107-rust-record-library-replacement-survey.md`、`docs/investigations/261107-rust-record-idiomatic-implementation-review.md` 与前者资源目录的 `findings.json`。两项行为选择及八项 should-change 已获批准。编码与测试 owner 分别为 `docs/coding-style.md` 和 `docs/test-maintenance.md`。

## Goals / Non-Goals

目标是可观察的准确性与更小维护面，同时保留现有事务、JSON 和失败边界。非目标：clap、petgraph、thiserror、全局 DTO、性能测量、生产切换、发布、额外 Windows runner 或扩展文件安全机制；不改 TypeScript 生产入口。

## Decisions

### Intended Change

- CLI-002 按域修正 discard/publish 帮助，不改参数语法；CLI-003 的 DR selected 预检及执行失败使用已验证的工作区相对索引路径；CLI-004 将 symlink 专属测试整体限定 Unix。
- INFRA-001 将 libc 移至 Unix 条件 dev-dependency，保留 tempfile；AUTHOR-003 复用现有 is_kebab，保留路径与错误；OPS-003 复用 JsTrim，仍检查原值 CR/LF 与修剪后长度。
- OPS-002 以 Result 成功值传递已验证结果，不借可变 Option 副作用；保留验证时机、错误和排序。OPS-001 一次 prepare 传递同一读取/解析基线，保留原第二路径的 graph 验证、selector/review 相对失败顺序及独立的 capture_plan 入口；预检和执行分别 prepare，不新增 CAS 或隔离保证。
- MODEL-001：IR 已索引当前来源的只读 show/content 身份核验一致容忍开头单个 BOM；不改返回原文、指纹、stale 或搜索位置，正式 check/sync 仍严格。
- AUTHOR-002：selected 检查索引回退定位时只读合格成员头部发现身份，仅所选来源做全文校验；无关损坏正文不阻断，保留必要身份与安全错误及回退中仍需定位的重复所选 ID 诊断，不为索引已定位的 ID 额外扫描全集。重新捕获所选全文时核验身份与安全边界。
- AUTHOR-001 比较后保留现有转换：新增显式映射会重复 Serde 与 domain_relation 已有名称，未见净维护收益；不增加泛型层，不改变两域对外字符串。

### Resulting Impacts

候选 protocol 是这两项候选行为的稳定 owner；若公共 skill 契约同步会改变 TS 生产语义，报告 owner 冲突，不擅自扩展生产改动。测试覆盖两域 help 的正反例、默认/自定义目录和两种失败路径、BOM 原文及严格校验、回退头/正文和安全错误、准备失败顺序及各规则边界。测试实现变更须执行测试设计与 Case 审核。Cargo 锁与目标编译须核对；Rust 候选不自动进入生产 skill 包。局部实现选择不新增 ADR；调查报告及资源不回写。

## Risks / Trade-offs

头部读取不可掩盖头编码错误、不安全成员、回退中仍需定位的重复所选 ID 或所选全文错误；测试不能以未选正文失败替代安全证明。复用基线不能丢失 graph 验证或改变失败优先级。BOM 兼容只作用于身份发现，不等于正式来源合法。Windows 交叉编译不是原生执行证据。

## Open Questions

无需要用户额外决策的开放问题；若发现候选与公共 owner 存在实际冲突，按上述边界报告。
