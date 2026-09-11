### Case INVESTIGATION-RENAME-HISTORY-001: recorded report 与 candidate 使用各自确认 flag

Tests:
- `test:58095189f9e5d9aa224a013c84b7ed735aebc7b17d6b88b05260721cd8f5c26f`

Tags:
- `investigation-report`

Contract:
- 已进入 Git HEAD 的 formal report 与 candidate rename 分别要求 `--rename-recorded-report` 或 `--rename-recorded-candidate`，确认只适用于当前工作树。

Proves:
- 无 flag 的 formal 和 candidate rename 分别返回对应 attention。
- 使用对应 flag 后两种 rename 都成功。
