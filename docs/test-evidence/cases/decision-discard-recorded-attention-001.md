### Case DECISION-DISCARD-RECORDED-ATTENTION-001: Discard 在删除已记录决策前暂停

Tests:
- `test:a08a706128f7592582c033785b28adde562a3582e5154cf6a7d7c76680871d6a`

Tags:
- `decision-records`

Contract:
- 完整且未被引用的 Decision ID 已进入 Git `HEAD` 时，首次 `discard` 必须零写入 attention；只有显式加入 `--delete-recorded` 才能删除目标。

Proves:
- 首次 discard 保留目标文件和正式索引；带参数重试只删除选定目标，保留同级候选。
