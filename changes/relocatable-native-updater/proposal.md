# Proposal

将原生安装和更新收敛到可搬迁的当前包覆盖。

## Why

安装状态依赖历史绝对路径，搬迁后无法更新。

## Outcome

按当前 SKILL.md 版本检查并安全覆盖安装，保留包外文件。

## Scope

### Intended Change

合并安装与更新覆盖流程，以临时备份支持普通失败恢复。

### Resulting Impacts

同步生成入口、原生发布验收、说明和测试。

## Success Criteria

- 搬迁完整目录后能更新；包外文件保留，版本检查只读且不下载 ZIP。
- 安装器支持多级缺失的目标目录，并可显式同版本重装；安装和更新校验角色、版本、资产及平台执行位并确认覆盖。
- 普通失败恢复，恢复不完整保留备份及精确诊断；生成与交付链同步。

## Affected Owners

[Updater](../../tools/skill-updater/README.md)、[分发](../../docs/tooling-distribution.md)、[测试证据](../../docs/test-maintenance.md)、[Decision Records](../../skills/decision-records/SKILL.md)、[Investigation Report](../../skills/investigation-report/SKILL.md)。
