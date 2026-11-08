### Case INVESTIGATION-QUERY-STALENESS-001: show 读取正文与来源过期边界

Tests:
- `test:d2f29b2b4a4e5053b2f3f2c4358cde771ef56387619f414a6a44d57eb8931d18`

Tags:
- `investigation-report`

Contract:
- show 读取所选当前正文并根据索引来源指纹报告过期，同时校验身份与 UTF-8。

Proves:
- 含 BOM 正文按原样返回；匹配指纹无 warning，移除 BOM 后出现 warning；错误身份和非法 UTF-8 失败。
