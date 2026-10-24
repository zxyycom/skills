### Case GATE-VIDEO-INPUT-CLOSURE-001: 视频源码资源与分发副本共同失效对应输入证明

Tests:
- `test:f66300742475f3f387855db15c67b7b7ad584b1a08a0c1bed45a2ec7aae51925`

Tags:
- `repository-tooling`

Contract:
- video-understanding 的源码、资源、测试与分发副本属于同一输入能力；三个视频语义 Check 订阅该能力，公开分发额外依赖统一生成检查，变化不得漏判为未知 owner 或复用旧证明。

Proves:
- 视频源码、资源、ignored fixture、测试/wrapper、Windows 验收/制品入口与分发 manifest/runtime 的代表改动均保持 video 能力闭合，三项视频 Check 与统一生成执行。
- 非 scripts 的视频输入变化保留 Novel Cards 与 Index Runtime 独立检查复用；scripts 组只核当前矩阵明示的消费，不声称所有领域沿宽 scripts/** 失效；精确发布后 warm 无激活。
