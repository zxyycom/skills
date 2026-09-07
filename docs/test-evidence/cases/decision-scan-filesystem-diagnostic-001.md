### Case DECISION-SCAN-FILESYSTEM-DIAGNOSTIC-001: 扫描访问拒绝按稳定诊断输出并净化 detail

Tests:
- `test:266676c601184de284f1045c394f0d5787146ec34803590f0d8eb4a4ff654250`

Tags:
- `decision-records`

Contract:
- Decision scan 遇到直接文件系统访问拒绝时，用户可见诊断必须提供稳定 reason、`access-denied` causeCategory 与受控 detail，不能暴露绝对路径或凭据。

Proves:
- 注入 EACCES 来源读取失败后，查询错误诊断使用稳定 filesystem reason 和 `access-denied`。
- detail 中的 password 和绝对路径均被净化，不含原始敏感值。
