### Case RESOLVED-FIRST-PARENT-ENDPOINTS-REUSE-001: 已解析提交范围不重复解析端点

Tests:
- `test:4605bb8c933a91f9d21c15079dc4a34e32835132ef7960b01636f80dd06119ed`

Tags:
- `git-integration`
- `version-control`

Contract:
- 专用 first-parent 历史入口接受已由同一仓库解析的提交 ID，不再次解析引用或查询 HEAD；相同端点返回空历史。

Proves:
- 将仓库的引用解析和 HEAD 查询方法替换为失败断言后，真实提交范围仍返回预期提交及文件行数变化，相同提交范围返回空数组。
