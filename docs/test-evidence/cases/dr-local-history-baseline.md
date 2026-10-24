### Case DR-LOCAL-HISTORY-BASELINE-001: 历史门禁只读取可定位的必要对象

Tests:
- `test:157411773ef15638568806590c48361d1c698570bce6743ef733211d664cb255`
- `test:75cd3d3781fb46fac4736e42995c94f389a6392a065876060a1d0a56e9ec4530`
- `test:a88127758aef4b2c25cf94d40ebfcd7ef1bb379ee650cf9778c3da4aa6cc0f3f`
- `test:f87f5d4c88c1891a9334951ef3a8616e3aac8242ad4bded9ca99eb237f746f8b`

Tags:
- `decision-records`

Contract:
- 历史门禁从合法 HEAD 索引定位本次必要历史正文，缺少已有历史集合索引须显式恢复；不能全量 blob 发现身份；每份所选历史 payload 必须逐 sourcePath 匹配预期 ID，不以多选身份集合相等代替路径绑定。

Proves:
- 删除未选历史正文的实际 Git blob 后，所选 archive 仍成功，未选索引条目保持。
- HEAD 有正式 Markdown 却无索引时 archive 明确报告历史索引恢复，所选正文和当前索引不变。
- evolve 的最终覆盖关系指向已在 HEAD 记录的 archived 目标时，门禁正确识别已记录；目标工作区坏正文不阻断候选建立或被读取修复。
- HEAD 中两份所选正文互换 ID 而索引未变、W 已恢复正确来源时，多选历史读取明确 history-baseline-invalid；当前来源、索引与 pending tree 均保持。
