# 上游原始参考快照

`planning-before-create-skill/` 保存创建本 skill 时参考的上游原始 skill。当前设计尚未稳定，因此该快照作为分发内容随 `skill-design-discovery` 一同提供，方便维护者在本地对照并自行取舍原始机制。

- 来源：https://github.com/thePlannerIvan/planning-before-create-skill
- 固定提交：[`53ac965acd7f1ea3c81b05aa1bc50d3de9578723`](https://github.com/thePlannerIvan/planning-before-create-skill/commit/53ac965acd7f1ea3c81b05aa1bc50d3de9578723)
- 快照日期：2026-07-21
- 上游许可：AGPL-3.0-only；许可证、NOTICE、署名与商标说明保留在快照内。

## 分发与使用边界

1. 当前 skill 发布和安装时包含完整快照；这是一项明确的分发选择，不将其视为应从包中排除的仓库临时文件。
2. 只在维护 `skill-design-discovery`、核对原始设计或判断是否回收某项机制时读取。
3. 快照不是当前行为契约，也不是待执行的嵌套 skill；当前 owner 是 [SKILL.md](../../SKILL.md) 和 [设计契约](../design-contract.md)。
4. 普通设计发现不加载快照，避免旧流程、品牌信息和上游环境假设进入当前输出。
5. 快照中的 evals 和示例只作为上游设计证据，不直接复制为当前 skill 的固定验证案例；验证义务从当前目标和证据即时推导。
6. 回收有效机制时，在当前 owner 中重新表达并验证；快照本身保持原样。需要更新上游版本时，按新的固定提交整体刷新并同步本文件。

快照保留原 skill 的入口、references、agent metadata、review asset、evals、README 和法律文件；仓库级 `.gitignore` 未复制。快照中的上游作品继续受其 AGPL-3.0-only 许可、NOTICE、署名和商标说明约束。
