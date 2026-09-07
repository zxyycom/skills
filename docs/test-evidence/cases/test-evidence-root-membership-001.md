### Case TEST-EVIDENCE-ROOT-MEMBERSHIP-001: Case 根目录拒绝额外成员

Tests:
- `test:0b8076abda39c105b27bb3d4bb24b688cb8db4149cebe9b5d56423f684d2edc2`

Tags:
- `test-evidence`

Contract:
- Case 根目录只能包含受控的 cases 目录和派生索引。

Proves:
- 额外根成员产生 case.root-member-unsupported 诊断。
