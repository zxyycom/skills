//! Exact Windows file attribute validation and handle-based application.
use super::*;

pub(in crate::source) fn validate_exact_attributes(attributes: u32) -> Result<(), SourceError> {
    use windows_sys::Win32::Storage::FileSystem::{
        FILE_ATTRIBUTE_ARCHIVE, FILE_ATTRIBUTE_HIDDEN, FILE_ATTRIBUTE_NORMAL,
        FILE_ATTRIBUTE_NOT_CONTENT_INDEXED, FILE_ATTRIBUTE_READONLY, FILE_ATTRIBUTE_SYSTEM,
        FILE_ATTRIBUTE_TEMPORARY,
    };
    let supported = FILE_ATTRIBUTE_ARCHIVE
        | FILE_ATTRIBUTE_HIDDEN
        | FILE_ATTRIBUTE_NORMAL
        | FILE_ATTRIBUTE_NOT_CONTENT_INDEXED
        | FILE_ATTRIBUTE_READONLY
        | FILE_ATTRIBUTE_SYSTEM
        | FILE_ATTRIBUTE_TEMPORARY;
    if attributes == 0
        || attributes & !supported != 0
        || (attributes & FILE_ATTRIBUTE_NORMAL != 0 && attributes != FILE_ATTRIBUTE_NORMAL)
    {
        return Err(SourceError::UnsupportedPlatform);
    }
    Ok(())
}
pub(in crate::source) fn set_exact_attributes(
    file: &File,
    attributes: u32,
) -> Result<(), SourceError> {
    use windows_sys::Win32::Storage::FileSystem::{
        FILE_BASIC_INFO, FileBasicInfo, SetFileInformationByHandle,
    };
    validate_exact_attributes(attributes)?;
    let info = FILE_BASIC_INFO {
        CreationTime: 0,
        LastAccessTime: 0,
        LastWriteTime: 0,
        ChangeTime: 0,
        FileAttributes: attributes,
    };
    // SAFETY: file is an open writable handle, info is initialized and its exact size is supplied.
    let ok = unsafe {
        SetFileInformationByHandle(
            file.as_raw_handle() as HANDLE,
            FileBasicInfo,
            (&info as *const FILE_BASIC_INFO).cast(),
            std::mem::size_of::<FILE_BASIC_INFO>() as u32,
        )
    };
    if ok == 0 {
        return Err(SourceError::Io(io::Error::last_os_error()));
    }
    if file_identity(file, false)?.mode != attributes {
        return Err(SourceError::Changed(PathBuf::from("file attributes")));
    }
    Ok(())
}
