### Case CHANGE-PLAN-SOURCE-MISSING-001: 缺失依赖启动失败不隐式安装

Tests:
- `test:e2c712a05ffe8e56fb37f1cc9d804db79331bc1e8dec7f0c4c605b7232780c28`

Tags:
- `change-plan`
- `distribution`

Contract:
- 普通运行和 help 不自动安装依赖；依赖不可解析时保留原生定位诊断，安装由使用者显式选择。

Proves:
- 隔离目录没有依赖时 Node 退出 1 并报告 ERR_MODULE_NOT_FOUND/缺失包；skill node_modules 未被创建。
