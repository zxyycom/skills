//! Library-backed classification and pure compression observations.
use super::{
    CompressionMethod, CompressionObservation,
    payload::Payload,
    policy::{Level, Policy},
};

#[derive(Debug, PartialEq, Eq)]
pub(super) enum Category {
    Text,
    Media,
    Archive,
    Executable,
    Binary,
    UnknownEncoding,
}

impl Category {
    pub fn level(&self, policy: &Policy) -> Level {
        match self {
            Self::Text => Level::Off,
            Self::Media => policy.binary.media,
            Self::Archive => policy.binary.archive,
            Self::Executable => policy.binary.executable,
            Self::Binary => policy.binary.unknown,
            Self::UnknownEncoding => Level::Info,
        }
    }
}

pub(super) struct Detected {
    pub name: String,
    pub category: Category,
}

pub(super) fn detect(bytes: &[u8]) -> Detected {
    if let Some(kind) = infer::get(bytes) {
        return Detected {
            name: kind.mime_type().into(),
            category: known_category(kind),
        };
    }
    let encoding = content_inspector::inspect(bytes);
    let (name, category) = if encoding.is_binary() {
        ("suspected-binary".into(), Category::Binary)
    } else if encoding == content_inspector::ContentType::UTF_8
        && let Err(error) = std::str::from_utf8(bytes)
        && error.error_len().is_some()
    {
        ("unknown-text-encoding".into(), Category::UnknownEncoding)
    } else {
        (encoding.to_string(), Category::Text)
    };
    Detected { name, category }
}

fn known_category(kind: infer::Type) -> Category {
    match kind.matcher_type() {
        infer::MatcherType::Text => Category::Text,
        infer::MatcherType::Image | infer::MatcherType::Audio | infer::MatcherType::Video => {
            Category::Media
        }
        infer::MatcherType::Archive => Category::Archive,
        infer::MatcherType::App => Category::Executable,
        _ if kind.mime_type() == "application/pdf" => Category::Media,
        _ => Category::Binary,
    }
}

pub(super) fn compression(
    payload: &Payload,
    size: u64,
    policy: &Policy,
) -> std::io::Result<Option<CompressionObservation>> {
    let c = &policy.compressibility;
    let Some(band) = c.band(size) else {
        return Ok(None);
    };
    let (method, chunks): (_, Vec<&[u8]>) = match payload {
        Payload::Full(bytes) if size <= c.full_file_bytes => (CompressionMethod::Full, vec![bytes]),
        Payload::Full(bytes) => (
            CompressionMethod::Sampled,
            c.windows(size)
                .map(|w| &bytes[w.start as usize..w.end as usize])
                .collect(),
        ),
        Payload::Partial(chunks) => (
            CompressionMethod::Sampled,
            chunks.iter().map(Vec::as_slice).collect(),
        ),
    };
    let mut input = 0;
    let mut compressed = 0;
    for chunk in chunks {
        input += chunk.len() as u64;
        compressed += zstd::bulk::compress(chunk, 1)?.len() as u64;
    }
    if input == 0 {
        return Ok(None);
    }
    Ok(Some(CompressionObservation {
        method,
        algorithm: "zstd-1",
        input_bytes: input,
        compressed_bytes: compressed,
        compressed_ratio: compressed as f64 / input as f64,
        threshold: band.max_compressed_ratio,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn library_classification_distinguishes_archives_unicode_and_unknown_encoding() {
        let policy = Policy::default();
        let archive = detect(b"\x1f\x8b\x08\0\0\0\0\0\0\0");
        assert_eq!(archive.name, "application/gzip");
        assert_eq!(archive.category.level(&policy), Level::Warn);
        assert!(archive.category != Category::Text);
        let unicode = detect(b"\xff\xfeh\0i\0");
        assert_eq!(unicode.name, "UTF-16LE");
        assert!(unicode.category == Category::Text);
        assert_eq!(unicode.category.level(&policy), Level::Off);
        let unknown = detect(b"\xffnot-null");
        assert_eq!(unknown.name, "unknown-text-encoding");
        assert_eq!(unknown.category.level(&policy), Level::Info);
        assert_eq!(detect(b"\0data").name, "suspected-binary");
    }
}
