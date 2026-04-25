export function register() {
  if (
    process.env.NEXT_RUNTIME !== "nodejs" ||
    process.env.NEXT_PHASE === "phase-production-build"
  ) {
    return;
  }

  void import("./instrumentation-node")
    .then(({ registerNodeInstrumentation }) => {
      registerNodeInstrumentation();
    })
    .catch(() => {
      // Warm-up registration is non-fatal.
    });
}
