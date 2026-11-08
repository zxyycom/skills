### Case RECORD-DIAGNOSTIC-SYSTEM-RENDERING-001: Git 失败不透出子进程 stderr

Tests:
- `test:459520c2533f7f1ea9b9adcafbd31ab8a0f4e52ec87c232894cdbec635fb24a6`

Tags:
- `investigation-report`

Contract:
- Git 子进程失败诊断不得直接泄露其 stderr 中可能包含的凭据。

Proves:
- 真实 IR stage CLI 使用假 Git：假进程在 stderr 输出无害 token sentinel 并失败，标准输出和标准错误都不含该 sentinel，JSON 失败信息保留受控的工作区发现失败原因。DR 与 IR 共用 Git 工作区发现错误处理，但此节点只直接执行 IR；不证明任意错误自由文本均被净化。
