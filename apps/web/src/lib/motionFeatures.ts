// Lazily-loaded Framer Motion feature bundle for `LazyMotion`. Importing
// `domAnimation` (animations + hover/tap/focus gestures; no layout/drag) from a
// dedicated module lets the bundler split it into its own async chunk so it
// stays off the initial critical path.
export { domAnimation as default } from "framer-motion";
