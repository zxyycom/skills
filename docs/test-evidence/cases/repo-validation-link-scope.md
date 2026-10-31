### Case REPO-VALIDATION-LINK-SCOPE-001: 结构校验不承担 skill 链接检查

Tests:
- `test:15e17f77eb5210667527cfb46d31cadaa262cc0103f537de61fbe8980c617af9`

Tags:
- `repository-tooling`

Contract:
- 仓库结构 validate 校验 skill 结构，不把正文坏链接当作本入口错误。

Proves:
- 健康临时仓库基线 errors=[]；单独加入缺失 skill 链接后仍 errors=[]、skillCount=1。
