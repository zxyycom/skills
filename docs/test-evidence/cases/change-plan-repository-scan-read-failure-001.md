### Case CHANGE-PLAN-REPOSITORY-SCAN-READ-FAILURE-001: 无法安全检查 Change 根时阻断

Tests:
- `test:19a7e54c4899392a415e90a774b47bae96256a1de185ab95919d4fb30d9e41bb`

Tags:
- `change-plan`
- `repository-boundary`

Contract:
- 仓库边界检查以可读取的普通真实目录为根；无法完成检查时返回读取失败并阻断后续操作。

Proves:
- 根为符号链接、缺失路径或普通文件时，边界检查返回 change-root-read-failed。
- 经符号链接根访问真实目标的单项 check 也返回该诊断。
