### Case INVESTIGATION-CANDIDATE-PUBLISH-005: 发布前重新核对所选候选与索引

Tests:
- `test:b38e52f9e89cdb53991240fa2d657ccdb40b42c415f634486851d0e1148b71ac`
- `test:ef4dcdcf6b678c4e7b3c65ea702475999f3cbcebc570312e665f2d1a8cb480e0`

Tags:
- `investigation-report`

Contract:
- 普通 publish 在提交前重新验证所选候选与当前索引；这些受保护事实漂移时不发布。

Proves:
- 分别修改 selected candidate 与索引，publish 拒绝且不执行写入器，候选保持在 authoring workspace。
