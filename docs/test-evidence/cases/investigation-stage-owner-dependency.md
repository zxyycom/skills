### Case INVESTIGATION-STAGE-OWNER-DEPENDENCY-001: 资源 owner 是验证依赖而非写入目标

Tests:
- `test:f3afffec59cf5eedfce8e0c006f48809dab365640ad42e3119b8a45b980cd74f`

Tags:
- `investigation-report`

Contract:
- 直接共享资源的正式 owner 须验证，不自动扩大写入选择。

Proves:
- 共享 owner 及所选报告各读两次，依赖未进入选择或写入；owner 不符合发布引用时拒绝，pending 不变。
