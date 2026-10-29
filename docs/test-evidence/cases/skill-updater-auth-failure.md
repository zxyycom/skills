### Case SKILL-UPDATER-AUTH-FAILURE-001: HTTP 认证失败不匿名重试或切换身份

Tests:
- `test:1d554dcddd40840168025cad014ccc64c7f36b88a7af37113e4df911423f5783`

Tags:
- `skill-updater`

Contract:
- 已选凭据的 GitHub 请求失败时保留 HTTP 失败，不降级匿名请求或重新选择身份。

Proves:
- 源码 CLI 取得一次受控 gh 凭据后，release 查询返回 401 并以该状态的错误拒绝；只发出一个带认证的请求，没有匿名警告、重试或后续 asset 请求，也不输出凭据。
