//! Resource advisory settings, shared by all investigation CLI operations.
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Level {
    Off,
    Info,
    Warn,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Band {
    pub min_bytes: u64,
    pub max_compressed_ratio: f64,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Compression {
    pub enabled: bool,
    pub full_file_bytes: u64,
    pub sample_window_bytes: u64,
    pub sample_windows: u32,
    pub bands: Vec<Band>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Binary {
    pub media: Level,
    pub archive: Level,
    pub executable: Level,
    pub unknown: Level,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Policy {
    pub enabled: bool,
    pub file_bytes_warn: u64,
    pub report_bytes_warn: u64,
    pub report_files_warn: usize,
    pub read_budget_bytes: u64,
    pub max_files: usize,
    pub exact_duplicates: Level,
    pub binary: Binary,
    pub compressibility: Compression,
}

impl Default for Policy {
    fn default() -> Self {
        Self {
            enabled: true,
            file_bytes_warn: 1_048_576,
            report_bytes_warn: 10_485_760,
            report_files_warn: 30,
            read_budget_bytes: 33_554_432,
            max_files: 1024,
            exact_duplicates: Level::Warn,
            binary: Binary {
                media: Level::Info,
                archive: Level::Warn,
                executable: Level::Warn,
                unknown: Level::Warn,
            },
            compressibility: Compression {
                enabled: true,
                full_file_bytes: 1_048_576,
                sample_window_bytes: 65_536,
                sample_windows: 4,
                bands: vec![
                    Band {
                        min_bytes: 65_536,
                        max_compressed_ratio: 0.10,
                    },
                    Band {
                        min_bytes: 262_144,
                        max_compressed_ratio: 0.15,
                    },
                    Band {
                        min_bytes: 1_048_576,
                        max_compressed_ratio: 0.20,
                    },
                ],
            },
        }
    }
}

impl Policy {
    pub fn validate(&self) -> Result<(), String> {
        let c = &self.compressibility;
        let limits = [
            ("fileBytesWarn", self.file_bytes_warn, 1, u64::MAX),
            ("reportBytesWarn", self.report_bytes_warn, 1, u64::MAX),
            (
                "reportFilesWarn",
                self.report_files_warn as u64,
                1,
                u64::MAX,
            ),
            ("readBudgetBytes", self.read_budget_bytes, 1, 268_435_456),
            ("maxFiles", self.max_files as u64, 1, 10_000),
            (
                "compressibility.fullFileBytes",
                c.full_file_bytes,
                1,
                16_777_216,
            ),
            (
                "compressibility.sampleWindowBytes",
                c.sample_window_bytes,
                1,
                1_048_576,
            ),
            (
                "compressibility.sampleWindows",
                u64::from(c.sample_windows),
                2,
                16,
            ),
        ];
        for (field, value, min, max) in limits {
            if !(min..=max).contains(&value) {
                return Err(format!("{field}: expected {min}..={max}, got {value}"));
            }
        }
        c.validate_bands()
    }
}

impl Compression {
    pub(super) fn windows(&self, size: u64) -> impl Iterator<Item = std::ops::Range<u64>> {
        let width = self.sample_window_bytes.min(size);
        let count = self.sample_windows;
        (0..count).map(move |i| {
            let offset =
                ((u128::from(size - width) * u128::from(i)) / u128::from(count - 1)) as u64;
            offset..offset + width
        })
    }

    fn validate_bands(&self) -> Result<(), String> {
        if self.bands.is_empty()
            || self
                .bands
                .windows(2)
                .any(|b| b[0].min_bytes >= b[1].min_bytes)
        {
            return Err(
                "compressibility.bands must be nonempty and strictly ordered by minBytes".into(),
            );
        }
        if self.bands.iter().any(|b| {
            b.min_bytes == 0 || !(0.0 < b.max_compressed_ratio && b.max_compressed_ratio <= 1.0)
        }) {
            return Err("compression bands require positive minBytes and ratios in (0, 1]".into());
        }
        Ok(())
    }
}
