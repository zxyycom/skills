### Case INVESTIGATION-STAGE-DELETION-UNKNOWN-IDENTITY-001: 局部删除不发现未知位置的未同步身份

Tests:
- `test:a91a996b222a4cdf9ed57e21bf080510da7c51ca60e7d4f105b8eef069b86db4`

Tags:
- `investigation-report`

Contract:
- stage 删除只核对发布声明和已知受管位置，未知 W 位置重现由显式全量 check/sync 发现。

Proves:
- 发布索引删除后同 ID 在未知位置重现，stage 不读该正文且只暂存已知旧路径删除；全量 check 报不同步，sync 将该 ID 重新发布在实际位置。
