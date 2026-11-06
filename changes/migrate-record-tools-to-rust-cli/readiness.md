# Readiness 工程准备依据

从 [tasks.md](tasks.md) 的 0.1 开始准备；本文件提供盘点起点和已知工程缺口，既不是领域契约，也不是完成证据。目标与范围由 [proposal.md](proposal.md) 承接，设计边界由 [design.md](design.md) 承接。

## 能力与结果盘点

两域共同的 14 个命令为 `candidates`、`check`、`discard`、`list`、`new`、`publish`、`rename`、`search`、`set-relations`、`show`、`show-candidate`、`stage`、`sync-index`、`trace`；DR 另有 `archive`、`evolve`、`mark-aligned`、`reactivate`。这是盘点起点，不证明参数及结果映射完整。源码入口为 [DR 命令类型](../../tools/decision-records/src/cli/arguments/cli-args.ts)和 [IR 命令类型](../../tools/investigation-report/src/cli/cli-contract.ts)；现行操作以 [DR 维护](../../tools/decision-records/README.md)、[IR 维护](../../tools/investigation-report/README.md)及[共同操作模型](../../tools/record-operations/model.md)为准。

盘点每个命令的参数、默认值、作用范围、失败与结果，并追踪仓库可核实的调用者及其所需信息。区分生产调用、维护、测试与生成副本；[package.json](../../package.json)、[DR 生成维护](../../scripts/build/decision-records.ts)和 [IR 生成维护](../../scripts/build/investigation-report.ts)是入口线索，生成 wrapper 和测试导入不自动算作独立用户调用。外部安装副本和私有脚本不在仓库搜索范围，外部样本可补充映射但不阻塞，也不能据此假定没有其他调用者。

两域现有成功 `trace --json` 各有结构：[DR renderer](../../tools/decision-records/src/cli/output/trace/cli-output-trace.ts)显式输出来源、锚点、限制、覆盖、成员、frontier、可选 blockedEvent 和 entries；[IR CLI](../../tools/investigation-report/src/cli/commands/cli-query-commands.ts)序列化成功结果并将 warning 写入 stderr。以各自实际契约为基准，勿假定 envelope 相同。其他 JSON 应覆盖调用者需要的信息，而非仅包装文本；例如 [IR 声明源码](../../tools/investigation-report/api/check-investigations.d.mts)的内容搜索 preview 有文本 renderer 未打印的 `column`。还需核对来源与完整性、筛选与匹配计数、预算、关系核对、stage 的 pending/写集、诊断和恢复。

## 工程定稿与证据接入

- **平台**：在 Windows 原生和 Linux 范围内提出并冻结具体 target、ABI、最低运行环境与可证明的安全语义，按实际环境验证。Windows x64（MSVC）和 Linux x64（glibc）可作为候选，未经验证不构成支持承诺；WSL 不证明 Windows 原生。
- **架构与协议**：确定源码/crate 归属、跨语言 schema 权威源、输出协议及单次复用边界；fresh 和写后验收必须独立重新采集。[源码与分发 owner](../../docs/tooling-distribution.md)承接跨语言 schema 与打包输入的归属。
- **测试与性能**：按测试矩阵接入 Cargo 原生测试节点、项目 Case 和 Windows/Linux CI。[现有 CI](../../.github/workflows/package-skills.yml) 的 Windows job 面向视频；[测试快照命令识别](../../scripts/test-evidence/snapshot/snapshot-commands.ts)及[类型](../../scripts/test-evidence/snapshot/snapshot-types.ts)目前列出 Bun/Node，Cargo 证据采集须作为工程工作接入，见[测试维护](../../docs/test-maintenance.md)。旧实验不构成本候选的性能证据。
- **工具链与制品**：确定独立 Rust 构建与测试 scope，隔离现行 quick、生成和发布入口；设计未来 GitHub 资产与 Git pending 打包输入。旧文件覆盖及恢复边界见 [updater 维护](../../tools/skill-updater/README.md)，离线试验不证明线上更新。

工程负责定稿上述事项。发现真实平台需求缺口、需要改变公开结构或语义、持久格式，或扩大授权范围时，提出具体影响与取舍供用户确认。
