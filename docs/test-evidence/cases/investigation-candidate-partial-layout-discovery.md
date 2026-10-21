### Case INVESTIGATION-CANDIDATE-PARTIAL-DISCOVERY-001: 局部候选读取保留移动 owner 发现

Tests:
- `test:9d1136e7099d8dff50bb83ae1f26f9c0e87c1c781bcb03afc55559de18673a42`

Tags:
- `investigation-report`

Contract:
- 局部 layout 尚无正式来源时，候选共享资源可发现移动后的正式 owner，索引不可用时仍按现有发现 fallback 取得身份。

Proves:
- 正式 owner 移动但尚未同步索引时仍可读取候选；随后索引 JSON 损坏或删除时同样成功，候选资源无错误。
