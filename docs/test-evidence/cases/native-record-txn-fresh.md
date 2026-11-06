### Case NATIVE-RECORD-TXN-FRESH-001: 事务 fresh、提交点和并发保护

Tests:
- `test:06cbeb18fcf30ae2b7903a9cf4e8f988570f26d02fc7399238825b1c6234e03e`
- `test:1aad74bcd5faa589ed32ebcfa075d374d9e008f4669792d35aa4871d51c5b92b`
- `test:3c547c964f0fe90b45e457f265498c29d7624665a2e2e8252fbc74eb6a69b3c0`
- `test:7b0db39f9d9bb1a6f5a8b0dddb7c6ce1698bcd7bbf0ceb86afded3bfe75c6837`
- `test:9aab2cca57fcfa0f9863be17cea82a385b8890606f02083c467876be86dec568`
- `test:9b01f5e2cf4504299651747351c47d4f87148223cd9578962e20f2efc0384f8d`
- `test:a2162c2b02b965f1d38f826bcea655cb907827b7559bb0e80774300228ab5bf1`
- `test:d7b0168067e5f713b5d290efdbc4c7d0e89e7d013866cd4b257928bd2af0619f`
- `test:e312deee7bbaba89a44e1d915f1591074f5d6406a9963c28a7ac11fd00505db6`
- `test:fed04f6ff3933a3e2ef3058715b5118d3651965be33f4923966db2f9b94a9fd8`

Tags:
- `record-rust`

Contract:
- 事务对实际写集进行写后独立复验，提交前后失败须区分恢复事实。

Proves:
- 真实私有文件及合作锁验证源漂移、排他创建、提交点、竞争写者及条件恢复。
