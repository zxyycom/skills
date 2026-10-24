### Case GATE-VIDEO-INPUT-CLOSURE-001: 视频源码资源与分发副本共同失效对应输入证明

Tests:
- `test:f66300742475f3f387855db15c67b7b7ad584b1a08a0c1bed45a2ec7aae51925`

Tags:
- `repository-tooling`

Contract:
- video-understanding 的源码、资源、测试与分发副本属于同一输入能力；三个视频语义 Check 订阅该能力，公开分发额外依赖统一生成检查，变化不得漏判为未知 owner 或复用旧证明。

Proves:
- 分别改变领域源码、Python helper、运行时环境和配置、依赖要求、被 Git 忽略的资源、测试 helper 与聚合入口、Windows 验收入口与制品测试、分发入口和运行时、分发 manifest 与锁文件时，三个视频 Check 与统一生成检查都执行，输入保持闭合。
- 领域及分发变化下 Novel Cards 和 index-runtime 的原有证明可复用；Windows 验收脚本变化仍按现有 `scripts/**` 消费关系失效其他领域证明，index-runtime 不受影响。发布成功证明后再次采集不激活任何项目 Check。
