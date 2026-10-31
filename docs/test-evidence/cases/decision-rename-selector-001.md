### Case DECISION-RENAME-SELECTOR-001: dated source 精确选择且 name 歧义拒绝猜测

Tests:
- `test:89fdfaf0e7635ac1da079565e6e7c6520b9d57b0facce4d4b48de7c1d8030560`

Tags:
- `decision-records`

Contract:
- source 先按 calendar-valid dated ID 精确匹配，失败后才按 unique name 匹配；archive rename 保持 archive 生命周期位置。

Proves:
- 重名 name source 返回 `rename-source-ambiguous`。
- 同名 dated source 仍被精确 rename，旧 archive path 被新 archive path 替代。
