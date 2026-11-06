### Case NATIVE-RECORD-SOURCE-MOVE-001: 资源目录迁移与条件恢复

Tests:
- `test:04926c90e4bd204ff6704f73d3abed6480ce49102b37135874555ffd70c85eb4`
- `test:1f60e466e7356aa2f4f1d276b601cbddfb6b4dd3726c25898bde5d2d7138846d`
- `test:4ca6cbfb42c96692c0d76ffe5be5d9be8a5995ed0936756748058337681c14ce`
- `test:5852142fe658efdd37611c39efd2cbcf29cafdd2e9bfb95a37a255ab6d745443`
- `test:7065142098c1e0aed4f21395661c47d582d02092c6e84b8043556c9f7907cfaa`
- `test:73b2867ed3bf133e783ba60cc9475a42e8d7850fae4de59d1fbdf83b375a81d3`
- `test:90ad243f148a1cdf5dbab37e8115b213cd37aaf50a6334d0671cc3edc17a2698`
- `test:c2d5e430f52605bd3f1305b34d81d1411cdea1963ea5837bccff6251a3301691`
- `test:dc47948e76a2fec2172a3b646024da62ca6520ae524aeaac431b9442e11d3fe1`

Tags:
- `record-rust`

Contract:
- 目录迁移只能移动已证明的源，并保留竞争者与恢复所需事实。

Proves:
- 真实目录、目标冲突、源替换、移动后漂移与条件恢复按实际字节和状态核对；验证 Linux 模式；父目录替换必须实际发生，再验证拒绝和原树保留。
