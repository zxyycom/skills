### Case INVESTIGATION-DISCARD-CANDIDATE-001: 未就绪候选的显式删除

Tests:
- `test:ad74713b84803d52e15fb3e2e900e7298f5c042d38c9a5c05c3d898f9926d0d0`

Tags:
- `investigation-report`

Contract:
- 候选正文未完成且有未引用 owner 资源时，允许显式授权删除该候选。

Proves:
- 带 delete-owned-resources 的调用成功并提交，候选路径退出。
