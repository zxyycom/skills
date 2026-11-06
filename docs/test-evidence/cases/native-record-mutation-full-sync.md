### Case NATIVE-RECORD-MUTATION-FULL-SYNC-001: 两域全量同步的新鲜度和资源范围

Tests:
- `test:073dd4778a44b50ba7b9f27dafddfbe7872ad2d7cd4e43903f353f066dca0ef4`
- `test:2316c6678026a199ce045889194bff9c947c94f60a661eee62fcd6c775c90a0e`
- `test:25dc50b4872d5f3489babc35027ea34249f3ec3c0aa329938c10d89155696b45`
- `test:2c340ef8e6aa5d4546b9094e5325c433e8c1b9b030ef361520f956a510b16074`
- `test:6a081bf10f5a5856dfe51cfc3be0ef4c875f8f9e101022467a652af669e3984b`
- `test:c1824434b541caeb0bc9422b0cb3339a5c0aa024cebe9b04d845152af2991f9c`

Tags:
- `record-rust`

Contract:
- 全量同步须区分预检、fresh、写入和资源成员证据。

Proves:
- 私有来源与 Git 可见性变化验证 stale、无变化、资源出现及未引用资源诊断。
