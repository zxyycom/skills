### Case TEST-EVIDENCE-ROOT-MEMBERSHIP-001: Case 根目录拒绝额外成员

Tests:
- `test:6d089a966c5e9f9c493f872ccbd21349ddc50c0e5770bbe1c711c2db4d9e26d0`

Tags:
- `test-evidence`

Contract:
- Case 根目录只能包含受控的 cases 目录和派生索引。

Proves:
- 额外根成员产生 case.root-member-unsupported 诊断。
