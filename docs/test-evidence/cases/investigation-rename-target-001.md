### Case INVESTIGATION-RENAME-TARGET-001: 不一致或冲突 target 零写入失败

Tests:
- `test:615c1fab83b229531ecadd44efc728751167690045016ecd4fc076c1e209e3b3`
- `test:e06b9f36fcea339561836d2509411bc1559f02bfa2db7956bfec7aa33d4450ab`

Tags:
- `investigation-report`

Contract:
- 调查 rename 的目标日期必须匹配 formedAt 的 UTC 日，名称目标自动使用该日期。

Proves:
- 调查 target_identity 纯测试覆盖跨 UTC 日的名称自动日期、带 .MD 的完整 ID 和错误日期拒绝。
- 真实 IR CLI 另验证候选 rename 的预检与执行接线；本组合不声称真实 CLI 运行了错误日期 fixture。
