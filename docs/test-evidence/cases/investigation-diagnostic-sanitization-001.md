### Case INVESTIGATION-DIAGNOSTIC-SANITIZATION-001: Git 失败不泄露子进程 stderr

Tests:
- `test:459520c2533f7f1ea9b9adcafbd31ab8a0f4e52ec87c232894cdbec635fb24a6`

Tags:
- `investigation-report`

Contract:
- Git 子进程失败的外部 stderr 不得直接泄露到调查 CLI 输出。

Proves:
- Unix 私有 Git fixture 中假 Git 实际运行并向 stderr 写入无害模拟 token 后失败；真实 stage JSON 调用失败，stdout 和 stderr 均不含该 token，并保留 Git 失败提示。
