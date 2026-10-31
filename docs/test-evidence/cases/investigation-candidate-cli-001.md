### Case INVESTIGATION-CANDIDATE-CLI-001: candidate CLI separates creation success from readiness

Tests:
- `test:e194034f544eb348f53ebf587da9e81ceb2831a450d6dbf1ea40b378c06fa675`

Tags:
- `investigation-report`

Contract:
- `new` 成功创建候选后以退出码 0 报告正文 readiness，而保留候选文件名或成员安全错误仍阻断全量集合检查；局部正式检查不证明无关候选安全。

Proves:
- CLI 创建空正文 candidate 返回成功，stdout 显示完整 ID、标题、路径、三项 readiness，不调用或回显默认发布辅助预检；诊断保留在 stderr，不打印全文或固定下一步，且候选可由 `show-candidate` 读取。
- 不规范保留候选文件作为根目录安全错误阻断默认全量检查，但不阻断选定正式报告的局部检查。
