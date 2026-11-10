//! Cached headers and bounded supplementary reads, independent of content interpretation.
use super::policy::Compression;
use std::{
    io::{self, Read, Seek, SeekFrom},
    ops::Range,
};

pub(super) enum Payload {
    Full(Vec<u8>),
    Partial(Vec<Vec<u8>>),
}

impl Payload {
    pub fn from_head(head: Vec<u8>, size: u64) -> Self {
        if head.len() as u64 == size {
            Self::Full(head)
        } else {
            Self::Partial(vec![head])
        }
    }
}

pub(super) struct Request<'a> {
    pub size: u64,
    pub duplicate: bool,
    pub compression: Option<&'a Compression>,
}

pub(super) struct ReadBudget {
    limit: u64,
    used: u64,
}

impl ReadBudget {
    pub fn new(limit: u64) -> Self {
        Self { limit, used: 0 }
    }
    pub fn used(&self) -> u64 {
        self.used
    }
    fn remaining(&self) -> u64 {
        self.limit - self.used
    }
    fn reserve(&mut self, bytes: u64) -> io::Result<()> {
        if bytes > self.remaining() {
            return Err(io::Error::other(format!(
                "read budget exhausted: need {bytes} bytes, {} remain",
                self.remaining()
            )));
        }
        self.used += bytes;
        Ok(())
    }
    pub fn head(&mut self, file: &mut std::fs::File, size: u64) -> io::Result<Vec<u8>> {
        let amount = size.min(8192);
        self.reserve(amount)?;
        let head = read_window(file, 0..amount, &[])?;
        check_size(file, size)?;
        Ok(head)
    }
    pub fn plan(&self, request: Request<'_>, head_bytes: u64) -> Plan {
        let coverage = if (request.duplicate && request.size - head_bytes <= self.remaining())
            || request
                .compression
                .is_some_and(|c| request.size <= c.full_file_bytes)
        {
            Coverage::Full
        } else if let Some(c) = request.compression {
            Coverage::Sampled(c.windows(request.size).collect())
        } else {
            Coverage::Head
        };
        Plan {
            size: request.size,
            coverage,
        }
    }
    pub fn read(
        &mut self,
        file: &mut std::fs::File,
        head: Vec<u8>,
        plan: Plan,
    ) -> io::Result<Payload> {
        self.reserve(plan.additional_bytes(head.len() as u64))?;
        check_size(file, plan.size)?;
        let payload = match plan.coverage {
            Coverage::Full => {
                let mut bytes = head;
                file.seek(SeekFrom::Start(bytes.len() as u64))?;
                let old_len = bytes.len();
                bytes.resize(
                    usize::try_from(plan.size)
                        .map_err(|_| io::Error::other("resource is too large"))?,
                    0,
                );
                file.read_exact(&mut bytes[old_len..])?;
                Payload::Full(bytes)
            }
            Coverage::Sampled(windows) => Payload::Partial(
                windows
                    .into_iter()
                    .map(|window| read_window(file, window, &head))
                    .collect::<io::Result<_>>()?,
            ),
            Coverage::Head => Payload::from_head(head, plan.size),
        };
        check_size(file, plan.size)?;
        Ok(payload)
    }
}

pub(super) struct Plan {
    size: u64,
    coverage: Coverage,
}
enum Coverage {
    Full,
    Sampled(Vec<Range<u64>>),
    Head,
}

impl Plan {
    pub fn additional_bytes(&self, head_bytes: u64) -> u64 {
        match &self.coverage {
            Coverage::Full => self.size - head_bytes,
            Coverage::Sampled(windows) => windows
                .iter()
                .map(|w| w.end.saturating_sub(w.start.max(head_bytes)))
                .sum(),
            Coverage::Head => 0,
        }
    }
}

fn check_size(file: &std::fs::File, size: u64) -> io::Result<()> {
    if file.metadata()?.len() != size {
        return Err(io::Error::other("resource size changed during inspection"));
    }
    Ok(())
}

fn read_window(
    file: &mut (impl Read + Seek),
    window: Range<u64>,
    head: &[u8],
) -> io::Result<Vec<u8>> {
    let length = usize::try_from(window.end - window.start)
        .map_err(|_| io::Error::other("resource sample is too large"))?;
    let cached_end = window.end.min(head.len() as u64);
    let cached = cached_end.saturating_sub(window.start) as usize;
    let mut bytes = vec![0; length];
    if cached > 0 {
        bytes[..cached].copy_from_slice(&head[window.start as usize..cached_end as usize]);
    }
    if cached < length {
        file.seek(SeekFrom::Start(window.start + cached as u64))?;
        file.read_exact(&mut bytes[cached..])?;
    }
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    struct CountedReader {
        data: io::Cursor<Vec<u8>>,
        read_bytes: usize,
    }
    impl Read for CountedReader {
        fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
            let count = self.data.read(buffer)?;
            self.read_bytes += count;
            Ok(count)
        }
    }
    impl Seek for CountedReader {
        fn seek(&mut self, position: SeekFrom) -> io::Result<u64> {
            self.data.seek(position)
        }
    }

    #[test]
    fn sample_reader_reuses_cached_header_without_physical_rereads() {
        let bytes: Vec<_> = (0..10000).map(|i| (i % 251) as u8).collect();
        for (ranges, expected_reads) in [
            ([0..2500, 2500..5000, 5000..7500, 7500..10000], 10000),
            ([0..1000, 3000..4000, 6000..7000, 9000..10000], 9192),
        ] {
            let mut reader = CountedReader {
                data: io::Cursor::new(bytes.clone()),
                read_bytes: 0,
            };
            let head = read_window(&mut reader, 0..8192, &[]).unwrap();
            for range in ranges {
                let observed = read_window(&mut reader, range.clone(), &head).unwrap();
                assert_eq!(observed, bytes[range.start as usize..range.end as usize]);
            }
            assert_eq!(reader.read_bytes, expected_reads);
        }
    }
}
