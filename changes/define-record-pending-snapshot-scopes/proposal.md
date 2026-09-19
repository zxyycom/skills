# Proposal

本 Plan 为 Decision Records 与 Investigation Report 定义同一套选择性 Git pending 快照范围。

## Why

两个领域都能选择记录并更新待提交索引，但同名交付动作覆盖的领域文件不同。调用者无法仅凭命令判断成功后哪些 Markdown、资源和索引路径已经进入 pending，也难以可靠处理删除与重命名。

## Outcome

两个 CLI 都以 `stage` 构造所选正式记录的 pending 快照，默认原子处理索引和领域文件，并允许显式选择纯索引或纯领域范围。Selector 同时读取当前集合与 Git `HEAD`，每次成功都返回实际写入路径。

## Scope

### Intended Change

- 统一 `stage <selector...> [--scope <all|index|domain>]`，默认 scope 为 `all`。
- 从当前正式集合与 `HEAD` 基线的 ID 并集解析 selector，以覆盖新增、更新、删除和重命名。
- 定义 Decision Markdown 与 Investigation Markdown、完整 owner 资源树在 `domain` 中的精确范围。

### Resulting Impacts

- 两个领域的 staging 服务、Git pending replacement、结果类型和 CLI help 需要对齐。
- Investigation staging 需要读取 owner 资源树的工作区与 `HEAD` 成员，并保持其他 owner 资源隔离。
- 两个 skill、人类入口、生成制品、版本、staging 测试和 Test Evidence 需要同步。

## Success Criteria

1. `all` 原子写入所选索引投影与领域文件，`index` 只写入索引投影，`domain` 只写入领域文件。
2. Decision `domain` 覆盖所选正式 Decision Markdown；Investigation `domain` 覆盖所选正式报告 Markdown 及其完整 owner 资源树。
3. Selector 能解析当前集合或 `HEAD` 中的正式 ID；基线-only ID 写入删除；重命名要求同时选择旧 ID 与新 ID。
4. 所有 scope 都要求已同步且通过全量检查，并在写入前验证 `HEAD`、pending 快照和所选来源没有漂移。
5. 无关 pending 内容和其他 owner 的资源保持不变，结构化结果列出实际路径与保留范围。
6. 目标测试、生成检查、领域检查和完整仓库检查通过，Test Evidence 与测试入口一致。

## Affected Owners

- `tools/decision-records/` 与 `skills/decision-records/`
- `tools/investigation-report/` 与 `skills/investigation-report/`
- `tools/shared/src/version-control/` 与按需复用的 `tools/index-runtime/`
- `docs/skills/decision-records.md`、`docs/skills/investigation-report.md`
- `docs/test-evidence/cases/` 与 `docs/test-evidence/test-evidence-index.json`
- 记录公共 pending 快照范围的 `docs/decisions/`
