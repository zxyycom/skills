### Case INVESTIGATION-RESOURCE-CASE-001: attached resource links reject path casing mismatches

Tests:
- `test:e5913b8c51fd69bdb648464129b1c89cc31b5851cf2dc96ed9275d2bfaa49772`

Tags:
- `investigation-report`

Contract:
- 候选报告的资源链接须匹配资源路径的精确大小写。

Proves:
- 候选引用 evidence.txt 而实际文件为 Evidence.txt 时 resource readiness 失败并给出 casing 诊断。
