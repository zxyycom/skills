### Case VERSION-CONTROL-REPOSITORY-PATH-001: 将绝对后代路径转换为规范化仓库路径
Entry:
- `tools/shared/tests/version-control.test.ts > converts absolute descendants to normalized repository paths`
- `bun test --test-name-pattern="^converts absolute descendants to normalized repository paths$" ./tools/shared/tests/version-control.test.ts`
Contract:
- 文件系统路径转换只接受仓库根下的绝对后代，并返回规范化仓库相对路径。
Proves:
- 嵌套绝对路径转换为正斜杠路径；相对路径、仓库根和仓库外路径均返回 `invalid-path`。
