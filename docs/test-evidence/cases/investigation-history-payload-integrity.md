### Case INVESTIGATION-HISTORY-PAYLOAD-INTEGRITY-001: 有限历史保留不绕过全payload失败

Tests:
- `test:4159a2ccb1c07df1df52b9c3307864622c9aafc81765cbcce9359b21784af33a`
- `test:deb84616f4af929afcecfac240b134a8ec66bda63958ff88fc2c98bc55394339`

Tags:
- `investigation-report`

Contract:
- 历史身份仅保留 prefix 时，直属 formal 来源的完整 payload 读取失败仍产生 history-check-unavailable。

Proves:
- 无关直属 formal 对象缺失或腐败时输出历史检查不可用警告，不形成成功的存在判断。
