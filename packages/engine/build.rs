use std::path::Path;

fn main() {
    // The canonical protos live in the @uoplan/proto package so the schema is
    // shared with TypeScript. We compile engine.proto plus the data/state
    // schemas the engine decodes at runtime. protox is a pure-Rust protobuf
    // compiler, so no system `protoc` is required.
    let include_dir = Path::new("../proto/proto");
    let protos = [
        include_dir.join("engine.proto"),
        include_dir.join("data.proto"),
        include_dir.join("state.proto"),
    ];

    for proto in &protos {
        println!("cargo:rerun-if-changed={}", proto.display());
    }

    let file_descriptors =
        protox::compile(protos, [include_dir]).expect("Failed to compile protos with protox");
    prost_build::Config::new()
        .compile_fds(file_descriptors)
        .expect("Failed to generate prost code");
}
