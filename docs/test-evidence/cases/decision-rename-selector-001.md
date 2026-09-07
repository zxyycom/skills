### Case DECISION-RENAME-SELECTOR-001: dated source 精确选择且 name 歧义拒绝猜测

Tests:
- `test:ce5a875400a32e5069cd98d31d1ed98f641d28e1e58727e6ab645b8ab051b1d3`

Tags:
- `decision-records`

Contract:
- source 先按 calendar-valid dated ID 精确匹配，失败后才按 unique name 匹配；archive rename 保持 archive 生命周期位置。

Proves:
- 重名 name source 返回 `rename-source-ambiguous`。
- 同名 dated source 仍被精确 rename，旧 archive path 被新 archive path 替代。
