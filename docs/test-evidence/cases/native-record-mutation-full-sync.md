### Case NATIVE-RECORD-MUTATION-FULL-SYNC-001: 两域全量同步的新鲜度和资源范围

Tests:
- `test:82e360f0e62099c90bd5adfbe7dc730ae3a29196afb39580dd560659d1fb1155`
- `test:cd9e04ab25050f49eed5b576d4b01827edca775595580068c9ed579d927d3b49`
- `test:dd8167ee60e946904db658bf49899dae20f47daa6ae28a5676281d84a7688e27`
- `test:fed4491bac9a037ab05fa2c031fc29254b6127153d2342da02331fa7a2e69203`

Tags:
- `record-rust`

Contract:
- 全量同步须区分预检、无变化、来源和资源的实际状态。

Proves:
- 私有来源与资源验证预检不写、索引发布、资源变化和未引用资源诊断。
