### Case LIGHTWEIGHT-JUDGMENT-ADAPTER-011: 独立 Node 原生协议传输

Tests:
- `test:5b451aeaf55a355c141606a36716fdd2ab189e570e6de1d059c28f06a0f3d1f6`

Tags:
- `lightweight-judgment`

Contract:
- 分发 MJS 在无工作区依赖的独立 Node 进程中执行一次 native Decisions HTTP，保留 raw 与 normalized 双结果。

Proves:
- 临时复制 bundle、私有配置和有效合成 PNG 请求通过真实回环 HTTP 服务；接收端核对 Bearer、无 TypeSafe 头、有序 predicate 与图文 wire，子进程退出 0 且只发送一次；不证明远端服务可用。
