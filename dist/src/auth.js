import { timingSafeEqual } from "node:crypto";
export function extractBearerToken(headerValue) {
    if (!headerValue)
        return undefined;
    const match = /^\s*Bearer\s+(.+)\s*$/i.exec(headerValue);
    if (!match)
        return undefined;
    const token = match[1].trim();
    return token ? token : undefined;
}
export function isAuthorizedToken(expectedToken, candidateToken) {
    if (!expectedToken)
        return true;
    if (!candidateToken)
        return false;
    const expected = Buffer.from(expectedToken);
    const candidate = Buffer.from(candidateToken);
    if (expected.length !== candidate.length)
        return false;
    return timingSafeEqual(expected, candidate);
}
export function extractBasicCredentials(headerValue) {
    if (!headerValue)
        return undefined;
    const match = /^\s*Basic\s+(.+)\s*$/i.exec(headerValue);
    if (!match)
        return undefined;
    const encoded = match[1].trim();
    if (!encoded)
        return undefined;
    let decoded;
    try {
        decoded = Buffer.from(encoded, "base64").toString("utf-8");
    }
    catch {
        return undefined;
    }
    const colonIndex = decoded.indexOf(":");
    if (colonIndex === -1)
        return undefined;
    const username = decoded.slice(0, colonIndex);
    const password = decoded.slice(colonIndex + 1);
    return { username, password };
}
export function isAuthorizedBasic(expected, candidate) {
    if (!expected)
        return true;
    if (!candidate)
        return false;
    const expectedUser = Buffer.from(expected.username);
    const candidateUser = Buffer.from(candidate.username);
    if (expectedUser.length !== candidateUser.length)
        return false;
    if (!timingSafeEqual(expectedUser, candidateUser))
        return false;
    const expectedPass = Buffer.from(expected.password);
    const candidatePass = Buffer.from(candidate.password);
    if (expectedPass.length !== candidatePass.length)
        return false;
    return timingSafeEqual(expectedPass, candidatePass);
}
export function buildAuthCookieValue(token) {
    return encodeURIComponent(token);
}
export function readAuthCookie(cookieHeader, cookieName) {
    if (!cookieHeader)
        return undefined;
    for (const segment of cookieHeader.split(";")) {
        const trimmed = segment.trim();
        if (!trimmed)
            continue;
        const separatorIndex = trimmed.indexOf("=");
        if (separatorIndex === -1)
            continue;
        const key = trimmed.slice(0, separatorIndex).trim();
        if (key !== cookieName)
            continue;
        const value = trimmed.slice(separatorIndex + 1);
        try {
            return decodeURIComponent(value);
        }
        catch {
            return value;
        }
    }
    return undefined;
}
