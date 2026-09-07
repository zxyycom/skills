### Case INVESTIGATION-RESOURCE-TYPE-001: attached resource targets must be regular files

Tests:
- `test:e787e3765add8fb2466cec89dd6690da04fefa797fd82fa0bdc3153648b2eeef`

Tags:
- `investigation-report`

Contract:
- 随附资源只能是普通文件。

Proves:
- 目录资源目标返回 regular-file 诊断。
