//! Fingerprints for the selected source use the domain's published v2 byte contract.
use sha2::{Digest, Sha256};
#[derive(Clone, Copy)]
pub enum Domain {
    Decision,
    Investigation,
}
pub fn fingerprint(domain: Domain, id: &str, path: &str, text: &str) -> String {
    let (label, text) = match domain {
        Domain::Decision => ("decision-index-entry-v2", text.replace("\r\n", "\n")),
        Domain::Investigation => (
            "investigation-index-entry-v2",
            text.replace("\r\n", "\n").replace('\r', "\n"),
        ),
    };
    let mut hash = Sha256::new();
    hash.update(label.as_bytes());
    hash.update([0]);
    for field in [id, path, text.as_str()] {
        hash.update(field.len().to_string().as_bytes());
        hash.update(b":");
        hash.update(field.as_bytes());
        hash.update([0]);
    }
    format!("sha256:{:x}", hash.finalize())
}
/// Fingerprint of the empty metadata object under the domain's v4 definition.
pub fn metadata_fingerprint(domain: Domain) -> String {
    let label = match domain {
        Domain::Decision => "decision-index-metadata-v2",
        Domain::Investigation => "investigation-index-metadata-v4",
    };
    let mut hash = Sha256::new();
    hash.update(label.as_bytes());
    hash.update([0]);
    hash.update(b"2:{}\0");
    format!("sha256:{:x}", hash.finalize())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn metadata_fingerprints_match_independent_expected_bytes() {
        assert_eq!(
            metadata_fingerprint(Domain::Decision),
            "sha256:f072a7f67ac9bc191153034906027cabefa5e80bd40e104327b177a6bf9e0d0f"
        );
        assert_eq!(
            metadata_fingerprint(Domain::Investigation),
            "sha256:ad239f69455040edff99a6eaf4b9225367dda57fc00a297a785bfbc73a34be7b"
        );
    }
    #[test]
    fn source_newline_rules_are_domain_specific() {
        assert_eq!(
            fingerprint(Domain::Decision, "a", "a.md", "x\r\ny"),
            fingerprint(Domain::Decision, "a", "a.md", "x\ny")
        );
        assert_ne!(
            fingerprint(Domain::Decision, "a", "a.md", "x\ry"),
            fingerprint(Domain::Decision, "a", "a.md", "x\ny")
        );
        assert_eq!(
            fingerprint(Domain::Investigation, "a", "a.md", "x\ry"),
            fingerprint(Domain::Investigation, "a", "a.md", "x\ny")
        );
    }
}
