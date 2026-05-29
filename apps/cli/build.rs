use std::path::{Path, PathBuf};

fn main() {
    // The canonical cli.proto lives in the @uoplan/proto package so the schema
    // is shared with TypeScript. When building inside the monorepo we compile
    // that file directly; published crates (which don't ship the workspace)
    // fall back to the vendored copy under `proto/`. CI asserts the two are
    // identical (see scripts/check-architecture.mjs and cli-ci.yml).
    let canonical = Path::new("../../packages/proto/proto/cli.proto");
    let (proto_file, include_dir): (PathBuf, PathBuf) = if canonical.exists() {
        (canonical.to_path_buf(), Path::new("../../packages/proto/proto").to_path_buf())
    } else {
        (Path::new("proto/cli.proto").to_path_buf(), Path::new("proto").to_path_buf())
    };

    println!("cargo:rerun-if-changed={}", proto_file.display());

    let file_descriptors =
        protox::compile([&proto_file], [&include_dir]).expect("Failed to compile protos with protox");
    prost_build::Config::new()
        .compile_fds(file_descriptors)
        .expect("Failed to generate prost code");
}
