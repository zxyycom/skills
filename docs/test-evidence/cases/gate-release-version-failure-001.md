### Case GATE-RELEASE-VERSION-FAILURE-001: prepare 或版本失败阻断打包

Tests:
- `test:171f3f455370dd43fc6c79b83889e3fc8c629d91807306ebb43656abe566f1e3`

Tags:
- `repository-tooling`

Contract:
- prepare unavailable 或 prepare 已分析出的版本问题都会使授权无法 passed，且 `pack:skills` 不得通过或写入制品；版本问题以独立单行 Check messages 呈现。

Proves:
- 版本未提升和注入的 prepare 失败均阻断打包。
- 版本失败至少给出主消息与问题详情，且每条消息均不包含 CR、LF 或 Unicode 行分隔符。
