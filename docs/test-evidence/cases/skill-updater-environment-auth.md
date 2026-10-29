### Case SKILL-UPDATER-ENV-AUTH-001: 环境变量凭据优先且空白值不遮蔽后备凭据

Tests:
- `test:658e10aa2ec141c92a911eaaeedd29fdc45cd681db913ed43f17789d2a1995da`
- `test:7d9f03e295155b9dc96349c1a5fdd2610d35f6b8be7e8829ccb711455fb93fff`

Tags:
- `skill-updater`

Contract:
- updater 优先采用去除首尾空白后的非空 GITHUB_TOKEN，其次为 GH_TOKEN；已有环境凭据时不查询 gh。

Proves:
- 源码认证入口在两个环境变量均有值时选择 GITHUB_TOKEN，在 GITHUB_TOKEN 为空白时选择 GH_TOKEN；两种结果均已去除首尾空白，且没有 gh 调用或网络请求。
