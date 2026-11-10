//! Byte coverage and bounded file reads, independent of content interpretation.
use super::policy::Policy;
use std::io::{self, Read, Seek, SeekFrom};

pub(super) enum Payload {
    Full(Vec<u8>),
    Partial(Vec<Vec<u8>>),
}

impl Payload {
    pub fn head(&self) -> &[u8] {
        let first = match self {
            Self::Full(bytes) => bytes,
            Self::Partial(chunks) => &chunks[0],
        };
        &first[..first.len().min(8192)]
    }
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
    pub fn read(
        &mut self,
        file: &mut std::fs::File,
        size: u64,
        duplicate: bool,
        policy: &Policy,
    ) -> io::Result<Payload> {
        let plan = self.plan(size, duplicate, policy);
        self.reserve(plan.byte_count(size))?;
        let payload = plan.read(file, size)?;
        if file.metadata()?.len() != size {
            return Err(io::Error::other("resource size changed during inspection"));
        }
        Ok(payload)
    }
    fn plan(&self, size: u64, duplicate: bool, policy: &Policy) -> ReadPlan {
        let c = &policy.compressibility;
        let compression = c.enabled && size >= c.bands[0].min_bytes;
        if (compression && size <= c.full_file_bytes) || (duplicate && size <= self.remaining()) {
            ReadPlan::Full
        } else if compression {
            ReadPlan::Partial(c.windows(size).collect())
        } else if size <= 8192 {
            ReadPlan::Full
        } else {
            ReadPlan::Partial(std::iter::once(0..8192).collect())
        }
    }
}

enum ReadPlan {
    Full,
    Partial(Vec<std::ops::Range<u64>>),
}

impl ReadPlan {
    fn byte_count(&self, size: u64) -> u64 {
        match self {
            Self::Full => size,
            Self::Partial(windows) => windows.iter().map(|w| w.end - w.start).sum(),
        }
    }
    fn read(self, file: &mut std::fs::File, size: u64) -> io::Result<Payload> {
        match self {
            Self::Full => read_at(file, 0, size).map(Payload::Full),
            Self::Partial(windows) => windows
                .into_iter()
                .map(|w| read_at(file, w.start, w.end - w.start))
                .collect::<io::Result<_>>()
                .map(Payload::Partial),
        }
    }
}

fn read_at(file: &mut std::fs::File, offset: u64, size: u64) -> io::Result<Vec<u8>> {
    file.seek(SeekFrom::Start(offset))?;
    let mut bytes = vec![
        0;
        usize::try_from(size)
            .map_err(|_| io::Error::other("resource sample is too large"))?
    ];
    file.read_exact(&mut bytes)?;
    Ok(bytes)
}
