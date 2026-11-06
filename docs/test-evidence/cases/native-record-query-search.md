### Case NATIVE-RECORD-QUERY-SEARCH-001: 搜索匹配证据和内容边界

Tests:
- `test:045ca118cdb50dc7cd62c08d5230734cbd8e026b3e21144f29aa83e99afdd2b4`
- `test:14db0289cf9151b67118ad2bce522b41a2996694f9eb8b7cdf2862a6147204e5`
- `test:7b59c6c796eaeea22265216147d09cb80753038008d9a74c377e6718eaf0767b`
- `test:8a41b7470a7e30dcd63bb14599d1dfbf027f092e129a1c2c9f9c7fc07b1da52f`
- `test:af98f1b451d118d106b5002c86e96299576f1daed9cb2c695437ddb5ff7d2d5e`
- `test:cb3719729c8cf2c45c7619caa51da8d712fcdef71bc1e97f72f57145d4c44eed`
- `test:dd1eaa29b875a6ac01352d6e96cc1ed3da9ae3785ec0dd5a2ae8839be18b7edb`
- `test:ddbd96e2d971a31fe060b1438e6a09f5cd2ba43f256b43680752bdb2a89a8c85`
- `test:fd65ce18c71f88b9a16472c41b676428c87785cb9588e3c542b5b7e4b32d0532`

Tags:
- `record-rust`

Contract:
- 搜索结果须区分精确计数、预算下界、预览与源输入错误。

Proves:
- 双域 metadata 和内容搜索验证匹配证据、隐藏结果、UTF-16 预览、无效源和结构化错误。
