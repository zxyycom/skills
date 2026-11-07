### Case NATIVE-RECORD-TXN-PARTIAL-001: 有序写入的部分完成事实

Tests:
- `test:592b12ecc75b4655037eec92adc03ded155038a2154bb81e70ebfb671705d518`

Tags:
- `record-rust`

Contract:
- 顺序执行中后续写失败须报告先前实际完成的写入。

Proves:
- 私有文件对照后段失败、先前写集、提交状态与磁盘内容。
