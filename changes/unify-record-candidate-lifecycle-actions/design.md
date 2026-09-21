# Design

本 design 以候选状态转移为主线，统一公共动作，并把领域生命周期和资源安全保留在各自 owner。

## Context

候选与正式记录共享稳定 ID 空间，同一集合中不能同时存在同 ID 的两种实体，因此 `discard <id>` 可以唯一确定目标种类。两个领域的共同状态流是：

```text
不存在 ──new──> 候选 ──publish──> 正式记录
                    └──discard──> 不存在
正式记录 ──discard──> 不存在
```

Decision 正式记录另有 `active` / `archived` 和 alignment；Investigation 另有 owner 资源、共享引用与 `formedAt`。

## Goals / Non-Goals

目标：

- 共同状态转移使用相同动作词汇、预检语义和结果层次。
- Decision 首次建立与历史记录重新启用是两个明确状态转移。
- 删除入口先展示目标种类和完整范围，再应用历史与资源确认。

范围边界：

- Decision 的 `archive`、`reactivate`、`evolve` 与 alignment 继续表达领域生命周期。
- Investigation 继续拥有资源归属、共享引用和资源删除门禁。
- 正式关系替换与 Git pending 快照由相邻 Change 定义。

## Decisions

### Intended Change

共同动作如下：

| 动作 | 状态与结果 |
| --- | --- |
| `new` | 原子创建不覆盖的候选；创建结果与后续正文准备状态分开报告。 |
| `candidates` / `show-candidate` | 直接读取候选及其机械准备状态，不依赖正式索引。 |
| `publish --preflight` | 对显式候选和当前正式基线执行完整零写入预演。 |
| `publish` | 重新读取基线，把已审核、已授权且准备完成的候选建立为正式记录。 |
| `discard` | 识别候选或正式记录，报告删除范围并执行对应门禁。 |

Decision `publish` 要求显式 alignment，只完成候选自身的正式建立。`reactivate` 只执行 `archived` → `active`。需要同时建立后继并改变前序生命周期时使用 `evolve`。

Investigation `publish` 继续验证 `formedAt`、关系和资源。显式历史时间使用带时区、秒精度且无小数秒的 RFC 3339；独立报告可以没有前序，其他关系遵守领域图规则。

`discard` 统一使用 `--delete-recorded` 确认删除已经进入 Git `HEAD` 的候选或正式记录。Investigation 目标拥有资源时额外要求 `--delete-owned-resources`；共享引用门禁在两个确认参数之后仍然有效。

准备结果统一分为结构、正文、领域条件、语义审核和授权。门禁失败属于领域结果，参数形态无效才属于 CLI 参数错误。

### Resulting Impacts

- Decision Records 新增 `publish` 与 `reactivate` 公共入口，并让它们复用现有生命周期事务、锁和恢复结果；`evolve` 保持复合事务职责。
- Investigation Report 将候选与正式记录删除合并到 `discard`，并复用现有资源快照、历史检查与 tombstone 恢复能力。
- 目标命令替代 `activate` 和 `discard-candidate`；公开 help、parser、SDK 与文档只保留目标动作。
- 被取代的旧命令与目标专属旧参数不进入 legacy detector；调用只得到普通未知命令或无效参数结果。
- 目标专属 Git 删除确认参数收口为 `--delete-recorded`，Investigation 保留正交的 `--delete-owned-resources`。
- 两个 skill、人类入口、运行时制品、版本、生命周期与恢复测试、Test Evidence 同步更新。
- 公共候选生命周期形成或演进一份长期 Decision Record。

## Risks / Trade-offs

| 风险 | 控制 |
| --- | --- |
| `discard` 自动识别隐藏实际删除范围 | 预检与正式结果在写入前列出目标种类、来源、索引和资源成员。 |
| 拆分 Decision 入口复制事务逻辑 | `publish`、`reactivate` 和 `evolve` 共享准备、锁、写前验证和恢复组件，只拆分合法状态转移。 |
| 两个确认参数被理解为同一授权 | Help 与诊断分别说明 Git 历史和 owner 资源，且共享引用保持独立门禁。 |
| 命令更名影响既有调用 | 作为 skill 的破坏性版本变化发布；旧输入走普通未知命令或无效参数路径，当前 help 只展示目标表面。 |

## Open Questions

无。

## Implementation Dependencies

实施前先完成 `unify-record-cli-location-and-help` 与 `make-record-index-staleness-actionable`。本 Change
只拥有候选、正式记录和 Decision lifecycle 的动作与状态转移；关系输入归一化、关系审核形状和
`evolve --source` 由后续 `unify-record-relation-maintenance-actions` 承接，本 Change 不提前重构该边界。
