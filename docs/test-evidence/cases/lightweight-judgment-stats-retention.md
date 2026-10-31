### Case LIGHTWEIGHT-JUDGMENT-STATS-RETENTION-001: 当前摘要与正文隔离

Tests:
- `test:81eca07e7bda26e56aba60ac58d59de94ce862c12e2cacb25764c724dd4c51bd`

Tags:
- `lightweight-judgment`

Contract:
- stats 只消费当前库的调用摘要，不输出留存正文，也不从正文补推缺失元数据；零值与缺失分别统计。

Proves:
- 含请求与响应正文标记的当前库统计成功，inputTokens=7、outputTokens=0，两个字节数字段保持缺失；输出没有正文标记，原库字节不变。
