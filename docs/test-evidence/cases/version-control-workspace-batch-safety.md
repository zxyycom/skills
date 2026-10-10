### Case VERSION-CONTROL-WORKSPACE-BATCH-002: 批量读取拒绝不安全类型策略与 pending

Tests:
- `test:a0b459f1152e2cb2ab987830cb4ea6bca29302e92edc5626f878316bd685ee52`

Tags:
- `version-control`

Contract:
- 批量工作区读取保留路径、普通文件、执行位策略和 pending 表示验证，不写入工作区或 pending。

Proves:
- 非法路径、symlink、目录、非法 fileMode、pending symlink 与冲突 stage 均以结构化领域错误拒绝。
