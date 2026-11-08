### Case DECISION-ESTABLISHED-ALIGNMENT-001: 已建立记录要求明确对齐状态

Tests:
- `test:04a2b403b266a017aeccfea254943a7fcb7474d1fd49e61ec5e3ead988751ea3`

Tags:
- `decision-records`

Contract:
- active 与 archived 来源只能使用 aligned 或 unaligned；candidate 的 null 模型不属于已建立状态。

Proves:
- 原生 frontmatter parser 接受 active/archived 与 aligned/unaligned 的四种组合，并分别拒绝每种组合变体的 null 与缺失 alignment。
- 本节点验证来源解析，不宣称旧 TS 内存快照 API。
