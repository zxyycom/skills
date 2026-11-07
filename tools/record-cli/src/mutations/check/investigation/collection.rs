use super::*;

pub(super) struct CollectionMembers {
    pub resources_exist: bool,
    pub resource_root_unsafe: bool,
    pub members: Vec<DirectoryMember>,
}

pub(super) fn collect_members(
    root: &Root,
    dir: &RelativePath,
    directory: &str,
) -> Result<CollectionMembers, CheckError> {
    let listing = source::enumerate_directory(root, dir)
        .map_err(|e| error("collection-read", directory, e.to_string()))?;
    let mut collected = CollectionMembers {
        resources_exist: false,
        resource_root_unsafe: false,
        members: Vec::new(),
    };
    for member in listing.members.iter().cloned() {
        collected.record(member)?;
    }
    Ok(collected)
}

impl CollectionMembers {
    fn record(&mut self, member: DirectoryMember) -> Result<(), CheckError> {
        if member.name == "investigation-index.json" {
            if member.kind != MemberKind::File {
                return Err(error(
                    "index-invalid",
                    &member.name,
                    "index is not a regular file",
                ));
            }
        } else if member.name == "_resources" {
            if member.kind == MemberKind::Directory {
                self.resources_exist = true;
            } else {
                self.resource_root_unsafe = true;
            }
        } else {
            self.members.push(member);
        }
        Ok(())
    }
}
