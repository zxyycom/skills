### Case NATIVE-RECORD-MUTATION-FULL-SYNC-001: 两域全量同步的新鲜度和资源范围

Tests:
- `test:2c340ef8e6aa5d4546b9094e5325c433e8c1b9b030ef361520f956a510b16074`
- `test:3feb66438d31a390577e99ebe10e4f2c44e11f2a1123c840d90951c2f844e53a`
- `test:3ff6d35ecdd2dc7ed9a03ee89b181afc258d7ca53c5c1a22ac5e4ab0bb57edb3`
- `test:6a081bf10f5a5856dfe51cfc3be0ef4c875f8f9e101022467a652af669e3984b`

Tags:
- `record-rust`

Contract:
- 全量同步须区分预检、无变化、来源和资源的实际状态。

Proves:
- 私有来源与资源验证预检不写、索引发布、资源变化和未引用资源诊断。
