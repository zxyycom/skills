### Case INVESTIGATION-MEMBER-SCAN-UNSAFE-001: 成员采集拒绝符号链接与特殊文件

Tests:
- `test:9662962df6f376fbb70526b6144731f179b5445918355c8b5afe83ab7d479085`

Tags:
- `investigation-report`

Contract:
- 集合成员只接受普通文件或目录；符号链接与特殊文件必须失败。

Proves:
- 真实悬空符号链接与 Unix socket 分别导致带目标路径的不安全成员诊断，不能被遗漏或当作普通成员接受。
