# Proposal

本 Plan 为 Decision Records 与 Investigation Report 建立同一套工作区定位、参数位置和 help 契约。

## Why

两个 CLI 都能把当前目录作为工作区根，但全局选项的位置、help 解析、缺少 command 的行为和领域目录约束不同。同一种调用结构在两个工具之间不能复用，集合目录误传给 `--root` 时也缺少直接的恢复路径。

## Outcome

调用者在目标工作区中可以省略 `--root`；跨工作区调用时显式指定工作区根，领域目录始终使用工作区内相对路径。两个 CLI 对全局选项、help、不完整调用和路径错误采用同一语法与诊断。

## Scope

### Intended Change

- 统一 CLI 语法、全局选项位置、help 和缺少 command 的处理。
- 固定当前目录、工作区根和领域集合目录的解析关系。
- 统一路径规范化、工作区 containment 和误用恢复诊断。

### Resulting Impacts

- 两个 CLI parser、location 类型、help、退出码和 argv 测试需要对齐。
- Decision Records 的绝对领域目录行为收敛为工作区内相对路径。
- Skill 示例、人类入口、仓库短命令、生成制品、版本和 Test Evidence 需要同步。

## Success Criteria

1. 两个 CLI 都接受 `<cli> [global-options] <command> [command-options]`，并允许全局选项出现在命令选项之后；规范示例统一放在 command 之前。
2. 省略 `--root` 时使用 `process.cwd()`；`--root` 只表示工作区根；领域目录只接受解析后仍位于工作区内的相对路径。
3. `help [command]` 与 `<command> --help` 不读取集合状态；省略 command 显示顶层 help 并以参数错误结束。
4. 集合目录误传给 `--root`、绝对领域目录和越界相对路径都返回包含正确参数形态的诊断。
5. 目标 argv 测试、生成漂移检查、领域检查和完整仓库检查通过，相关 Test Evidence 与测试入口一致。

## Affected Owners

- `tools/decision-records/` 与 `skills/decision-records/`
- `tools/investigation-report/` 与 `skills/investigation-report/`
- `docs/skills/decision-records.md`、`docs/skills/investigation-report.md`
- `docs/tooling.md` 中受影响的仓库短命令
- `docs/test-evidence/cases/` 与 `docs/test-evidence/test-evidence-index.json`
- 记录公共 CLI 定位契约的 `docs/decisions/`
