### Case INVESTIGATION-CANDIDATE-PUBLISH-002: 发布不读取未选正式正文

Tests:
- `test:3184a8685cabc846e131c44302af75558d6e6d6c833e25defd62be36e3d7272f`

Tags:
- `investigation-report`

Contract:
- publish 以正式索引为基底，不要求未选正式正文当前或可读。

Proves:
- 未选正式正文分别缺失、损坏、过期或为符号链接时，预检和发布仍成功；未引用资源字节保留。
