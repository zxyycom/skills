# Design

以共同 Rust 底座和两域独立适配构建本地候选，通过完整操作和结果的联合验收兑现 proposal。

## Context

现行事务与领域契约由[共同操作模型](../../tools/record-operations/model.md)、[Index Runtime](../../tools/index-runtime/README.md)、[DR CLI](../../skills/decision-records/references/cli-operations.md) 和 [IR CLI](../../skills/investigation-report/references/cli-operations.md)承接。[Readiness](readiness.md) 提供能力盘点和工程证据接入的起点。

[原生查询性能](../../docs/investigations/261105-rust-native-query-performance.md)、[算法复杂度](../../docs/investigations/261105-rust-query-algorithmic-complexity.md)、[固定成本和规模](../../docs/investigations/261105-rust-query-fixed-cost-and-scale.md)、[trace 图性能](../../docs/investigations/261105-rust-trace-aligned-graph-performance.md)是既有实验认识，候选性能需另行测量。批量与共享会话索引另议，不构成本 Change 的依赖。

## Goals / Non-Goals

- 完整实现两域操作及用户依赖的结果粒度，保持领域独立性、持久格式和单次操作内的有效复用。
- 使用参数调用和预编译制品，保留已有多对象命令；不增加深层 SDK、插件、常驻服务或通用批次协议。Node 可继续承接 updater 和仓库维护。
- 候选源码、测试及验证 CI 可在授权范围内交付；生产 TS、SKILL、pack 和 updater 入口保持现状。本 Change 不切换生产、不发布，也不安装真实用户副本。未来生产切换、退役清理及远端发布须另获授权。

## Decisions

### Intended Change

#### 能力与 JSON

以 CLI、直接导出和真实消费者为起点，盘点两域命令、参数、默认值、范围和结果，将用户依赖的数据、诊断、source/coverage、mutation、阶段、恢复和 pending 事实映射到 JSON。范围包括 list/show/search/trace、候选读取与创建、publish/evolve、领域生命周期、关系替换、rename/discard、check/sync-index 和 stage；以源码清单补全每域命令及选项。

现有两域 `trace --json` 成功输出分别保持字段、类型、缺省/省略、数组顺序、预算和状态语义。其他命令由工程按映射设计 JSON，冻结协议版本、错误类别、输出通道和退出码；JSON 模式的 stdout 输出单个机器结果，成功和领域失败均可判读。人类文本无需逐字相同。结果粒度不等于保留 TS 签名，未使用的 SDK 辅助导出无需逐一转为命令；外部调用样本可补充映射。

#### 共同底座与事务

Rust 共享安全路径、索引和操作编排等共同机制；DR 与 IR 分别拥有解析、身份、关系、生命周期和结果适配。按实际责任确定 crate、目录和 schema 权威源，遵循[源码与依赖边界](../../docs/tooling-distribution.md#源码与依赖边界)及[编码规范](../../docs/coding-style.md)。

单命令在阶段内复用可复用快照与惰性图；fresh 和 postverify 独立重新采集。各操作遵循现有 owner 的只读/写入范围、权限、提交点与恢复事实，保留多对象 publish 等现有语义；预检与执行准备分别证明。

#### 候选制品与交付隔离

为冻结 target 构建本地原生制品，以隔离制品源和 fixture 验证 manifest、安装、更新与失败回退，绑定版本、target、hash 和来源。设计未来 GitHub 资产、manifest、skill hash 与 Git pending 构建输入的接线，以及旧入口的迁移、清理与恢复契约。现有 updater 只覆盖包内路径，不自动删除旧文件；原生二进制不提交 Git。验证 CI 不自动发布，离线试验的证据范围限于本地。

#### 测试与性能

先确定 Rust 工具链和独立测试 scope，按 Test Design 建立真实错误与行为边界矩阵，再实施 Cargo 原生测试、项目 Case 和 Windows/Linux CI；普通 quick 不新增 Rust 编译器前置。测试使用领域 owner 的独立预期、固定私有 fixture、真实 Git 边界和适当的新旧比较，并保持 Cargo 测试的独立性与执行成本可控。性能测量真实单次进程调用及不同规模，报告构图、I/O 和环境边界。

### Resulting Impacts

- 明确 JSON 的 stdout/stderr、退出码、schema、诊断和 Unicode 排序、UTF-16 预览等跨语言细节，保留公开可观察信息；来源范围与索引 schema 由领域 owner 规定。
- 安全验收覆盖严格 UTF-8、路径和符号链接、identity/mode、锁、CAS、pending 竞争、fresh、实际写入句柄、独立回读、提交前恢复与提交后失败，以及 unchanged、清理和解锁故障；非合作编辑的隔离仅按实际证据表述。
- 新制品须解决 Git pending 以外的构建输入、可复现身份及版本/target/hash 绑定。按决策记录门槛审查公开契约、分发和长期架构方向；测试变更按测试证据 owner 维护账本。现行生产用法只描述已生效的行为，候选契约清楚标识其状态。

## Risks / Trade-offs

跨语言文本排序、错误和文件系统差异可能造成表面等价，需用代表性契约和失败注入证明。完整写操作必须同时保持单次复用与阶段证明独立。平台权限与文件身份按冻结矩阵证明，不将 Unix 保证推及其他平台。

## Open Questions

- 工程在 Windows 原生和 Linux 范围内提出并冻结 target、ABI、最低运行环境与可证明的平台安全语义，再按实际环境验证；能力映射、schema 归属、Cargo 证据采集、CI、工具链和制品接线由 Readiness 定稿。
- 发现真实平台需求缺口、需要改变既有公开结构或语义、持久格式，或扩大授权范围时，提交具体影响与取舍供用户确认；否则按当前边界推进。
