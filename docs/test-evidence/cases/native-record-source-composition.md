### Case NATIVE-RECORD-SOURCE-COMPOSITION-001: 合并配置后有序展开来源组合

Tests:
- `test:a01b3bb3610fc0b54eda73ae4b51e2ac19580ce5d5e4d7c21db053b44bf7464a`

Tags:
- `investigation-report`
- `record-rust`

Contract:
- 来源 key 可组合其他 key 和内联来源，引用在项目与本地层合并后解析；相对 root 保留定义文件的目录基准，重复来源只保留首次深度优先出现项。

Proves:
- 配置 API 加载项目定义的组合及本地层补齐的引用后，展开为 first/research/reports、second/notes/reports 两源且顺序固定，重复引用 a 不增加来源。
