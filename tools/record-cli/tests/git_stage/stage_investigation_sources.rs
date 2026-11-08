use super::*;

fn source_doc(id: &str, title: &str) -> String {
    format!(
        "---\ntitle: \"{title}\"\nid: \"{id}\"\nformedAt: \"2024-02-29T00:00:00Z\"\nquestion: \"Question\"\ntags:\n  - \"tag\"\nrelations: []\n---\n\n## 形成时背景\n背景\n## 调查目的\n目的\n## 调查范围与依据\n依据\n## 调查结果与边界\n结果\n"
    )
}

fn source_index(records: &[(&str, &str, &str, &str)]) -> Vec<u8> {
    use serde_json::{Map, json};
    use sha2::{Digest, Sha256};
    let mut entries = Map::new();
    let mut revisions = Map::new();
    for &(id, path, title, body) in records {
        let mut hash = Sha256::new();
        hash.update(b"investigation-index-entry-v2\0");
        for value in [id, path, body] {
            hash.update(value.len().to_string().as_bytes());
            hash.update(b":");
            hash.update(value.as_bytes());
            hash.update([0]);
        }
        revisions.insert(id.into(), json!(format!("sha256:{:x}", hash.finalize())));
        entries.insert(id.into(), json!({"name":id.split_once('-').unwrap().1,"sourcePath":path,"title":title,"formedAt":"2024-02-29T00:00:00Z","question":"Question","tags":["tag"],"relations":[],"resourceIds":[]}));
    }
    serde_json::to_vec(&json!({"schemaVersion":4,"namespace":"investigations","definitionVersion":11,"metadata":{},"sourceRevision":{"metadata":format!("sha256:{}", "a".repeat(64)),"entries":revisions},"entries":entries})).unwrap()
}

#[path = "stage_investigation_sources/locator_identity.rs"]
mod locator_identity;
#[path = "stage_investigation_sources/pending_reconciliation.rs"]
mod pending_reconciliation;
#[path = "stage_investigation_sources/resource_safety.rs"]
mod resource_safety;
#[path = "stage_investigation_sources/resource_scope.rs"]
mod resource_scope;
#[path = "stage_investigation_sources/source_path.rs"]
mod source_path;
