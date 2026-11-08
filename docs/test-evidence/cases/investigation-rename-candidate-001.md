### Case INVESTIGATION-RENAME-CANDIDATE-001: candidate rename preflight 保持零写入

Tests:
- `test:e06b9f36fcea339561836d2509411bc1559f02bfa2db7956bfec7aa33d4450ab`

Tags:
- `investigation-report`

Contract:
- 候选 rename 的预检只读，正式执行才移动候选位置。

Proves:
- 真实 CLI 预检报告旧名、新名及 preflight 阶段，原候选仍存在；正式执行后旧位置不存在且新位置存在。
