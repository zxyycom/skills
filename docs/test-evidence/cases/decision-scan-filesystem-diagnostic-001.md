### Case DECISION-SCAN-FILESYSTEM-DIAGNOSTIC-001: 扫描访问拒绝按稳定诊断输出并净化 detail

Tests:
- `test:8540cb4dc025f7d40bd653258e221fe0a2031c1241f23b54622db8be1f5f0bfb`

Tags:
- `decision-records`

Contract:
- Decision scan 遇到直接文件系统访问拒绝时，用户可见诊断必须提供稳定 reason、`access-denied` causeCategory 与受控 detail，不能暴露绝对路径或凭据。

Proves:
- 注入 EACCES 来源读取失败后，查询错误诊断使用稳定 filesystem reason 和 `access-denied`。
- detail 中的 password 和绝对路径均被净化，不含原始敏感值。
