### Case INVESTIGATION-RENAME-SHARED-FRESH-001: 更名 hook 后取得 fresh 来源并复用同阶段保护

Tests:
- `test:a93779b82bf2b61627949ae7d83f4507a6474a32c75571e6024eba9fccec2e5c`

Tags:
- `investigation-report`
- `record-operations`

Contract:
- IR rename 在 beforePublish 后实际取得来源安全事实；同阶段完整 expected 等价的重叠保护共用观察，写后独立取得当前事实。

Proves:
- 真实 rename 的 hook 先于 fresh 来源观察；同阶段重叠保护共享来源读取，来源 freshness 仍实际发生，操作成功；读取计数的观察范围为同阶段来源保护。
