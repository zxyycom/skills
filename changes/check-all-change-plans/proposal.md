# Proposal

本 change 为 Change Plan 增加根目录级聚合校验，使调用方能够用一次命令判断一组 Change 是否全部通过现有机械检查。

## Why

当前 `check <change-directory>` 只能校验一个 Change。`list` 虽然为了展示状态会逐项调用同一个 checker，但无效成员不会使命令失败，文本输出也不展开诊断，因此不能作为 CI 或仓库级门禁。

缺少聚合校验后，调用方只能自行扫描目录、逐项执行命令并拼接退出状态。这会重复 active/archive 发现规则，也容易让不同调用方采用不一致的错误和退出语义。

## Outcome

- 新增 `check-all [change-root]` 聚合校验命令，默认检查全部 active Change。
- `--archived` 只检查历史 Change，`--all` 检查 active 与 archived；两者互斥。
- 聚合校验复用当前单 Change checker，返回逐项完整结果和稳定汇总；根目录错误或任一成员无效时整体失败。
- `list` 继续作为非门禁发现命令，单目录 `check` 的接口和语义保持不变。

## Scope

纳入范围：

- Change 根目录的聚合检查结果类型、目录发现复用和汇总逻辑。
- `check-all` 的 CLI 参数、文本与 JSON 输出、退出码和帮助。
- change-plan 行为入口、固定契约、人类说明、分发制品与独立版本。
- 聚合函数和 CLI 的成功、成员失败、根目录失败、生命周期集合选择与参数错误测试，以及对应测试证据。
- 聚合门禁的长期决策。

不纳入范围：

- 改变单 Change 的结构、阶段、assessment 或 Git 距离规则。
- 让 `list` 因无效成员返回失败。
- 默认把 archived Change 纳入持续门禁，或迁移历史归档以适配未来格式。
- 引入项目索引、名称解析或递归扫描。

## Success Criteria

- `check-all` 默认扫描 change root 的 active 直接子目录，并忽略保留的 `archive/` 容器。
- `--archived` 与 `--all` 使用和 `list` 一致的目录集合；符号链接仍不作为 Change 发现。
- 空的可访问目标集合通过；根目录不可访问、归档容器非法或任一成员无效时失败。
- 文本失败输出包含每个无效 Change 的完整诊断；JSON 输出包含汇总计数、所选集合范围、根级错误和逐项检查结果。
- 单目录 `check` 与 `list` 的现有退出语义保持不变。
- 源码测试、生成制品、skill 结构、测试证据、决策集合和仓库 quick 门禁通过。

## Affected Owners

- [`skills/change-plan/SKILL.md`](../../skills/change-plan/SKILL.md) 与 [`change-plan-contract.md`](../../skills/change-plan/references/change-plan-contract.md)：使用流程和精确 CLI/JSON/退出码契约。
- [`tools/change-plan/`](../../tools/change-plan/)：聚合结果、目录发现复用、CLI 实现和原生测试。
- [`docs/skills/change-plan.md`](../../docs/skills/change-plan.md)：面向人类的能力摘要。
- [`docs/test-evidence/change-plan/`](../../docs/test-evidence/change-plan/)：新增或调整原生测试入口的证据 case。
- [`docs/decisions/`](../../docs/decisions/)：聚合门禁的长期方向。
- [`skills/change-plan/scripts/`](../../skills/change-plan/scripts/)：从工具源码生成的可分发运行时。
