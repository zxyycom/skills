# Proposal

本计划将决策记录和调查报告工具共同迁移为可联合验收、尚未上线的 Rust CLI。

## Why

两域共享索引与记录操作底座，需要共同迁移和验收事务边界。现有 CLI 与程序化结果承载诊断、覆盖范围和失败恢复事实，迁移须覆盖完整操作。已有 Rust 查询调查提供方向，候选的功能和性能需独立验证。

## Outcome

在冻结的 Linux x64 glibc 目标上，交付两域共用 Rust 底座的本地候选 CLI、正式测试及联合验收证据：全部既有操作及用户依赖的程序化结果信息粒度等价，真实单次命令性能有可复现报告；生产 TS 入口保持运行，候选不接入生产或远端发布。Windows 原生候选延后；现有 TS 的 Windows 支持不变。

## Scope

### Intended Change

- 盘点两个领域的真实调用者、公开操作及程序化结果，建立逐结果盘点和所需输出到命令 JSON 的映射，再共同实现与验收；两域模型规则仍独立，共用底座而非复制两份；保持现有 Markdown、ID 和持久索引格式，必要变更另行确认。
- CLI 由参数调用，所有命令的 JSON、stdout、stderr 与退出码有明确契约；覆盖只读与全部 mutation、索引同步及 stage，保留已有多对象操作语义。
- 建立正式 Cargo 测试、项目 Case 证据与 Linux 原生候选 CI；仅本地离线试验原生制品打包和 installer/update，并设计 GitHub 原生制品描述、版本与 target/hash 绑定及失败恢复。

### Resulting Impacts

- 事务、路径安全、索引、pending、诊断与各领域规则必须跨新旧结果逐项核验；单次操作中的快照和惰性图复用不能退化。
- 新制品不在 Git 中提交，须明确未来构建、manifest、hash 与打包输入的 owner 和接线契约；现有生产 pack/updater 行为本轮不变。
- 按测试、CI、分发及长期决策 owner 的门槛接入或交接；平台 target 冻结后才实施平台相关代码和验收。

## Success Criteria

- 可追踪清单证明两域全部公开操作、调用者所需程序化结果及其新 JSON 映射均已实现，并经联合差分或契约验证。
- 在固定私有 workspace 或只读快照中验收，不修改真实记录；正式测试覆盖领域规则、文件安全、Unicode、并发与失败恢复，项目 Case 和 Linux 原生候选 CI 有实际通过证据；单次命令性能报告记录环境、数据、方法和新旧测量结果，不预设倍数。
- 本地离线制品及 installer/update 试验证明冻结 target、版本、hash 校验和错误回退；未来接入与退役契约明确，未切换生产入口、已安装 skill 或生产 pack，未发布正式 release 或 npm 包。

## Affected Owners

- `tools/decision-records/`、`tools/investigation-report/` 及对应 `skills/*/references/`：独立领域模型、操作和输出契约。
- `tools/record-operations/`、`tools/index-runtime/`、`tools/shared/`：共享操作、索引和版本管理证明；Rust 源码归属在 Readiness 确定。
- `docs/tooling-distribution.md`、`tools/skill-package/`、`tools/skill-updater/` 与仓库 CI：制品身份、更新和验证责任；生产接线另行授权。
- `skills/test-design/`、`skills/test-evidence-review/`、`docs/test-maintenance.md`：测试设计及 Case；适用长期方向由 `skills/decision-records/` 判断并归位。
