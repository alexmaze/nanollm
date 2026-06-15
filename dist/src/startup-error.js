export function handleServerStartupError(error, options) {
    const log = options.log ?? console.error;
    const exit = options.exit ?? process.exit;
    if (error.code === "EADDRINUSE") {
        log(`Failed to start nanollm: port ${options.port} is already in use.`);
        log("Use a different port in config.yaml, stop the other process, or set PORT.");
    }
    else {
        log("Failed to start nanollm:", error);
    }
    options.dispose();
    exit(1);
}
