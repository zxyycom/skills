### Case AUTO-PUSH-BRANCH-001: 自动推送只接受 Main 提交

Tests:
- `test:50e0567b0497b818e9cda97c04dd2bcc95422b880ec86014f009687227092edf`

Tags:
- `repository-tooling`

Contract:
- post-commit 自动推送只在当前 symbolic branch 为 `main` 时进入节流与远端写入；其他分支上的 commit 不触发任何 branch 的 push。

Proves:
- worker 分支提交后调用 helper，远端 main 保持不变，且节流 ref 仍不存在。
