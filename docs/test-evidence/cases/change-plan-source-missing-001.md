### Case CHANGE-PLAN-SOURCE-MISSING-001: 缺失依赖启动失败不隐式安装

Tests:
- `test:0d7d1cb2665b521850085c8494ab145d0c58de3bda627229b9c4058923b27971`

Tags:
- `change-plan`
- `distribution`

Contract:
- 普通运行和 help 不自动安装依赖；依赖不可解析时保留原生定位诊断，安装由使用者显式选择。

Proves:
- 隔离目录没有依赖时 Node 退出 1 并报告 ERR_MODULE_NOT_FOUND/缺失包；skill node_modules 未被创建。
