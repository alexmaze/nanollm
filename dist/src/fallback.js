export const FALLBACK_FAILURE_WINDOW_MS = 5 * 60 * 1000;
export class FallbackFailureTracker {
    failures = new Map();
    prune(name, now = Date.now()) {
        const recent = (this.failures.get(name) ?? []).filter((timestamp) => now - timestamp <= FALLBACK_FAILURE_WINDOW_MS);
        this.failures.set(name, recent);
        return recent;
    }
    recordFailure(name, timestamp = Date.now()) {
        const failures = this.prune(name, timestamp);
        failures.push(timestamp);
        this.failures.set(name, failures);
    }
    getFailureCount(name, now = Date.now()) {
        return this.prune(name, now).length;
    }
}
export function sortFallbackGroupMembers(members, getFailureCount) {
    return [...members].sort((left, right) => {
        const leftScore = Math.max(0, getFailureCount(left) - 1);
        const rightScore = Math.max(0, getFailureCount(right) - 1);
        return leftScore - rightScore;
    });
}
