use super::*;

// Temporary native investigation: each probe owns a separate private fixture.
// These observations do not replace the smoke test's actual move assertion.
pub(super) fn rename_diagnostics() -> Vec<(&'static str, Result<(), i32>)> {
    use std::os::windows::{ffi::OsStrExt, io::AsRawHandle};
    use windows_sys::Win32::{
        Foundation::HANDLE,
        Storage::FileSystem::{FILE_RENAME_INFO, FileRenameInfo, SetFileInformationByHandle},
    };
    ["padded", "nul", "absolute"]
        .into_iter()
        .map(|variant| {
            let (temp, root, old, new) = fixture();
            let tree = capture_tree(&root, &old).unwrap();
            let proof = capture_missing(&root, &new).unwrap();
            let prepared = prepare_move(&root, &tree, &proof).unwrap();
            let absolute = temp.path().join("resources/new");
            let name = if variant == "absolute" {
                absolute.as_os_str()
            } else {
                prepared.target_name
            };
            let name: Vec<u16> = name.encode_wide().collect();
            let offset = std::mem::offset_of!(FILE_RENAME_INFO, FileName);
            let mut size = (offset + name.len() * 2).max(std::mem::size_of::<FILE_RENAME_INFO>());
            if variant == "padded" {
                size = std::mem::size_of::<FILE_RENAME_INFO>() + name.len() * 2;
            } else if variant == "nul" {
                size += 2;
            }
            let mut storage = vec![0usize; size.div_ceil(std::mem::size_of::<usize>())];
            let info = storage.as_mut_ptr().cast::<FILE_RENAME_INFO>();
            // SAFETY: the aligned, zeroed buffer holds the header and complete UTF-16 name;
            // both handles remain live through this isolated no-replace call.
            let result = unsafe {
                (*info).Anonymous.ReplaceIfExists = false;
                (*info).RootDirectory = if variant == "absolute" {
                    std::ptr::null_mut()
                } else {
                    prepared.parent.as_raw_handle() as HANDLE
                };
                (*info).FileNameLength = (name.len() * 2) as u32;
                std::ptr::copy_nonoverlapping(
                    name.as_ptr(),
                    storage.as_mut_ptr().cast::<u8>().add(offset).cast::<u16>(),
                    name.len(),
                );
                SetFileInformationByHandle(
                    prepared.held.as_raw_handle() as HANDLE,
                    FileRenameInfo,
                    info.cast(),
                    size as u32,
                )
            };
            let observation = if result == 0 {
                Err(std::io::Error::last_os_error().raw_os_error().unwrap_or(-1))
            } else {
                Ok(())
            };
            (variant, observation)
        })
        .collect()
}
