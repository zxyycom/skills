### Case INVESTIGATION-CANDIDATE-PUBLISH-002: 发布基线与同批关系闭合

Tests:
- `test:930c609a450602de353eedcde0a8a97ff40d41f937d3394dbff80167f0a3ef5a`

Tags:
- `investigation-report`

Contract:
- publish 依赖合法发布基线和所选候选最终关系闭合，不证明未选前序正文当前。

Proves:
- 缺失 relation target 阻断预检并保留候选；当前前序正文发生未同步漂移时，索引关系仍足够支持发布预检。
