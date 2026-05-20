fn main() {
    let file_descriptors = protox::compile(["proto/cli.proto"], ["proto/"])
        .expect("Failed to compile protos with protox");
    prost_build::Config::new()
        .compile_fds(file_descriptors)
        .expect("Failed to generate prost code");
}
