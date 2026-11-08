### Case NATIVE-RECORD-QUERY-SNAPSHOT-001: 列表、显示与追踪快照投影

Tests:
- `test:374eb23f94f7ae8c430bd8dcdf9ee6859c44860d388b083d1a14d14094d997b6`
- `test:3a8f181056379a0d49a233c10cfa6f259afd99df10a3ce53a935ec5af57cc27e`
- `test:3b88c658f2cf70da23bb880d6e971be8ecef2ddd924c243c13b2c2608233492c`
- `test:3cad69a8c65e25f8d5be408deedb9aafeb16bd1813608a8e63da65af0d01eaa9`
- `test:42eb5cff49a4ba8f6ba9d3c5507e1b0d673372b9bc79321b0f35067b43dacfef`
- `test:8ad09f135902ceb10e7afd2f94bbfbd10c422906f74101b2e94a7e79c44bd1b0`
- `test:8f7d4e88a44f15b8b43b3150b2746fd965c22ba80c1d50679402762dcf9fe1ad`
- `test:8fc38b0078d1ddfea1f7f8b68c272611f888965e27c46498c028dd1fe1023fad`
- `test:d2f29b2b4a4e5053b2f3f2c4358cde771ef56387619f414a6a44d57eb8931d18`

Tags:
- `record-rust`

Contract:
- 查询结果须保留领域范围、分页和追踪的可观察事实。

Proves:
- 固定索引和源验证 list facets、show 身份及过期状态、事件预算和两域输出。
- 调查 show 保留开头 BOM 原文，以含 BOM 的指纹核对是否过期。
