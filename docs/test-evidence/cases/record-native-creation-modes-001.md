### Case RECORD-NATIVE-CREATION-MODES-001: 原生创建尊重两域权限请求与进程 umask

Tests:
- `test:04bf9093f3818e7ef19f74d1e2905c06b7d69f64075050b07169087ac57d9e06`
- `test:3d6eb88c5b500d0d695871791169053ab9246a2c3cb0eac83271fc909d7ef867`

Tags:
- `record-operations`

Contract:
- 候选与首次正式索引使用领域原生创建请求：DR 为 0666，IR 为 0600；不以 chmod 绕过 umask，已有来源的发布与表示保护继续使用精确 mode。

Proves:
- Decision 以semantic name请求创建并使用本次返回的标准ID继续发布，fixture不依赖固定执行日期。
- 独立 Node 子进程分别设置 umask 0002、0022、0200，断言创建与发布成功，DR 候选和首次索引分别为 0664、0644、0466，IR 分别为 0600、0600、0400；这些断言覆盖 POSIX 权限位与 umask，不证明 ACL 行为。
- 正式发布保留预先设为 0640 的所选来源 mode，不把原生新建规则套到已有来源的表示保持。
