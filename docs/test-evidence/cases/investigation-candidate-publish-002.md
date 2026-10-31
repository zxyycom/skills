### Case INVESTIGATION-CANDIDATE-PUBLISH-002: 发布基线与同批关系闭合

Tests:
- `test:ecf09aaa698d4f3654173a0d7bb43f9f648831d9c17a97f5373001d5532858e0`

Tags:
- `investigation-report`

Contract:
- publish 依赖合法发布基线和所选候选最终关系闭合，不证明未选前序正文当前。

Proves:
- 缺失 relation target 阻断预检并保留候选；当前前序正文发生未同步漂移时，索引关系仍足够支持发布预检。
