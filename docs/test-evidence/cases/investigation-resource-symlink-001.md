### Case INVESTIGATION-RESOURCE-SYMLINK-001: attached resources reject symbolic link targets

Tests:
- `test:203dc2ec1de15733a9cffe85facbcbee34a2a4a21f757ba6ce33e8f4c820eb93`

Tags:
- `investigation-report`

Contract:
- 候选报告引用的随附资源不能为符号链接。

Proves:
- Unix fixture 中引用指向外部文件的符号链接使 resource readiness 失败并给出链接诊断。
