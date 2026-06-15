export function isReleasedReaderStateError(error) {
    if (!(error instanceof Error))
        return false;
    const code = "code" in error ? String(error.code ?? "") : "";
    if (code !== "ERR_INVALID_STATE")
        return false;
    return /Releasing reader|Reader released/i.test(error.message);
}
export function shouldIgnoreStreamReadError(error, options) {
    if (options.cancelled)
        return true;
    if (options.completed && isReleasedReaderStateError(error))
        return true;
    return false;
}
