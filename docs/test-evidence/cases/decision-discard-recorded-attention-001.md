### Case DECISION-DISCARD-RECORDED-ATTENTION-001: Discard 在删除已记录决策前暂停

Tests:
- `test:710742cbec1527ed1c0a111f4533b07ae3b2084d9d63aec876aac63abc6014ff`

Tags:
- `decision-records`

Contract:
- 完整且未被引用的 Decision ID 已进入 Git `HEAD` 时，首次 `discard` 必须零写入 attention；只有显式加入 `--delete-recorded-decision` 才能删除目标。

Proves:
- 首次 discard 保留目标文件和正式索引；带参数重试只删除选定目标，保留同级候选。
