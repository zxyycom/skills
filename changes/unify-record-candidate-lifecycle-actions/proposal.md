# Proposal

本 Plan 让 Decision Records 与 Investigation Report 以相同动作表达候选创建、审核、建立和删除。

## Why

两个领域都有候选、机械准备、语义审核和正式建立过程，但首次建立、历史记录重新启用和删除使用不同动作边界。调用者需要记忆领域差异，且容易把发布门禁失败误判为命令或参数故障。

## Outcome

两个 CLI 以 `new`、候选查询、`publish --preflight`、`publish` 和 `discard` 表达共同候选生命周期；Decision 的归档、重新启用和复合演进，以及 Investigation 的资源安全继续由领域动作承接。

## Scope

### Intended Change

- 统一候选从创建到正式建立的公共命令、预检层次和结果语义。
- 将 Decision 的首次建立与 `archived` 记录重新启用拆为 `publish` 和 `reactivate`。
- 让 `discard` 自动识别候选或正式记录，并统一 Git 历史删除确认参数。

### Resulting Impacts

- Decision 生命周期服务需要提供独立的候选建立与重新启用入口，并保持现有事务恢复能力。
- Investigation 删除服务需要在同一入口中保留正式索引、Git 历史、owner 资源和共享引用门禁。
- 两个 CLI、SDK、help、skill、生成制品、版本、测试和 Test Evidence 需要同步。

## Success Criteria

1. 两个 CLI 共同支持 `new`、`candidates`、`show-candidate`、`publish --preflight`、`publish` 和 `discard`，并返回同层次的准备与 mutation 结果。
2. Decision `publish` 只建立显式候选且要求 alignment；`reactivate` 只处理 `archived` → `active`；`evolve` 承接同时改变后继与前序生命周期的复合事务。
3. `discard` 根据唯一 ID 判断候选或正式记录；进入 Git `HEAD` 的目标统一要求 `--delete-recorded`。
4. Investigation owner 资源删除额外要求 `--delete-owned-resources`，共享引用继续阻断不安全删除。
5. 公开 help 与 parser 只呈现目标动作；目标测试、生成检查、领域检查和完整仓库检查通过，Test Evidence 保持同步。

## Affected Owners

- `tools/decision-records/` 与 `skills/decision-records/`
- `tools/investigation-report/` 与 `skills/investigation-report/`
- `docs/skills/decision-records.md`、`docs/skills/investigation-report.md`
- `docs/test-evidence/cases/` 与 `docs/test-evidence/test-evidence-index.json`
- 记录公共候选生命周期的 `docs/decisions/`
