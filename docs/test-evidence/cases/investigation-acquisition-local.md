### Case INVESTIGATION-ACQUISITION-LOCAL-001: 单条读取与局部检查按需取得普通来源

Tests:
- `test:7dd31948d0c885a2a8d7af1e9cfcdd3b5d35ecd1081d832b9d1a54cf25f1e461`
- `test:d947d8f098f7047d41b57f797ad13a7d137195e08cc0810f586d6e96c98cd6df`

Tags:
- `investigation-report`

Contract:
- show 按发布 locator 读目标并检查身份；局部 check 优先定位选定来源，必要时发现移动或新增 ID，不承担全集健康。

Proves:
- show 与已索引局部 check 各只读目标一次，无关 malformed 不阻断；目标 symlink 被拒绝。
- 移动与未发布正式 ID 能由局部发现验证，indexChecked=false；同集合的全量 check 仍拒绝非法来源。
