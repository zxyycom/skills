# Proposal

本临时计划让 Markdown 内容检查复用精确的完整输入成功证明，并保持权威 Gate 的质量边界。

## Why

Markdown 内容检查已有逐文件计算事实缓存，但每轮仍扫描和结算。既有项目 receipt 事务能在完整输入一致时省略检查；将其用于 lint 前，必须补齐原生磁盘 Markdown 选集，不能只依赖 Git 可见材料。

## Outcome

本地 base Gate 在 Markdown 内容检查完整输入精确命中最近 passed receipt 时通过原生 condition 复用；输入变化保守执行，完整 Definition、链接检查以及 CI/release 全执行行为保持。

## Scope

### Intended Change

仅将 `markdown-lint` 接入既有能力、完整输入指纹、receipt 与原生启用条件；同一快照覆盖根目录、额外目录、Git ignored 的大小写 `.md`/`.markdown` 磁盘选集。

### Resulting Impacts

同步输入声明与已知归属、catalog/selection/proof 测试及 Case；演进原生每轮执行的长期政策，并更新工具链和 Gate 接入说明。

为使真实仓库的 receipt 事务可用，补齐基线中四个领域测试输入的既有能力归属；保持检查范围和 unknown 保守保护不变。

## Success Criteria

- 无相关输入变化时 lint 精确复用；Markdown 新增、删除、重命名、内容、kind/mode、配置或工具链变化使相关检查执行。
- ignored、根目录和额外目录 Markdown 不遗漏；未知、symlink、读取失败或预算不足保守执行。
- 失败、取消和起止漂移不发布 receipt；链接检查仍每轮执行，CI/release 不读写 receipt 且全执行适用项。
- 完整 Definition 保持 64 项，base 保持 61 项，复用范围扩为 53 项；项目测试、完整 Gate 与独立正确性审查通过。

## Affected Owners

`scripts/lib/vibe-gate/`、相关 Gate 测试与 `docs/test-evidence/`；`docs/tooling.md`、`docs/gate-check-authoring.md` 与 `docs/decisions/`。不修改 skill 本体，不引入第二缓存、runner、链接图或性能门槛。
