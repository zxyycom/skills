### Case AUTO-PUSH-BRANCH-001: 自动推送只接受 Main 提交

Tests:
- `test:8d3d0aec8606fb14381d6f777227039e71a286554b301c577c267a134e37d4b5`

Tags:
- `repository-tooling`

Contract:
- post-commit 自动推送只在当前 symbolic branch 为 `main` 时进入节流与远端写入；其他分支上的 commit 不触发任何 branch 的 push。

Proves:
- worker 分支提交后调用 helper，远端 main 保持不变，且节流 ref 仍不存在。
