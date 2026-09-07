### Case DECISION-DISCARD-RECORDED-ATTENTION-001: Discard 在删除已记录决策前暂停

Tests:
- `test:1435c4cbc2a9a4d9d032eabcc31ac9fc2f473c6636bcc60603ac78036d5e463e`

Tags:
- `decision-records`

Contract:
- 完整且未被引用的 Decision ID 已进入 Git `HEAD` 时，首次 `discard` 必须零写入 attention；只有显式加入 `--delete-recorded-decision` 才能删除目标。

Proves:
- 首次 discard 保留目标文件和正式索引；带参数重试只删除选定目标，保留同级候选。
