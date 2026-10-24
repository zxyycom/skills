### Case REPO-VALIDATION-LINK-SCOPE-001: 结构校验不承担 skill 链接检查

Tests:
- `test:262ae03e69c6582b0c60f1bd9a8e7fdd8b43a49e2668b6aff57414cd8e721198`

Tags:
- `repository-tooling`

Contract:
- 仓库结构 validate 校验 skill 结构，不把正文坏链接当作本入口错误。

Proves:
- 健康临时仓库基线 errors=[]；单独加入缺失 skill 链接后仍 errors=[]、skillCount=1。
