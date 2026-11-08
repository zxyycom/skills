### Case DECISION-DISCARD-RECORDED-ATTENTION-001: Discard 在删除已记录决策前暂停

Tests:
- `test:1ef283703a3c84fb1006fffe155d15b37ceb21971ce4cdc3e4ee3a4c06713426`

Tags:
- `decision-records`

Contract:
- 删除已记录决策需要显式确认，且不改变调用方 pending。

Proves:
- 未确认时操作报错、来源仍在且 Git index 字节不变；确认重试提交且 pending 仍不变。
