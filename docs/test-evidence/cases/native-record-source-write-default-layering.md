### Case NATIVE-RECORD-SOURCE-WRITE-DEFAULT-LAYERING-001: 默认写 key 独立合并与去重

Tests:
- `test:fb7f2cd75b1c8160e4d074a0ae2ed2f2987e85e4e2ea8af69f1b7064ceda2751`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- defaultWriteKey 按项目／本地层覆盖，在完整合并后展开并按来源身份去重；读取 defaultKey 不受写默认影响。

Proves:
- 本地写默认覆盖项目写默认，引用本地定义的重复 second 组合后合法收敛为一个 notes 来源，root 保留本地层相对路径基准。
- 同一配置的默认读取仍选择 all，并保留 first 与 second 两个来源。
