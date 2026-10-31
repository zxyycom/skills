### Case INVESTIGATION-ACQUISITION-LOCAL-001: 单条读取与局部检查按需取得普通来源

Tests:
- `test:0381c493aaf2dd8c1d5afef825827a0c46fa6ed00ccb8293a3fd87660d89e12f`
- `test:36eae212f9aa613a13d4cd675c7db4d19b7d69a44047ae9c948994aa9af2941c`

Tags:
- `investigation-report`

Contract:
- show 按发布 locator 读目标并检查身份；局部 check 优先定位选定来源，必要时发现移动或新增 ID，不承担全集健康。

Proves:
- 读取观察同时覆盖 readFile 与安全 FileHandle；show 与已索引局部 check 各只读目标一次，无关 malformed 不阻断；目标 symlink 被拒绝。
- 移动与未发布正式 ID 能由局部发现验证，indexChecked=false；同集合的全量 check 仍拒绝非法来源。
