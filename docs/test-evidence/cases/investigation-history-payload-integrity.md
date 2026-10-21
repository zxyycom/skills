### Case INVESTIGATION-HISTORY-PAYLOAD-INTEGRITY-001: 有限历史保留不绕过全payload失败

Tests:
- `test:4159a2ccb1c07df1df52b9c3307864622c9aafc81765cbcce9359b21784af33a`

Tags:
- `investigation-report`

Contract:
- 历史身份仅保留 prefix 时，直属 formal 来源的完整 payload 读取失败仍产生 history-check-unavailable。

Proves:
- 无关直属 formal 对象的完整 payload 腐败时输出历史检查不可用警告，而不形成成功存在判断或错误的前序缺失警告。
