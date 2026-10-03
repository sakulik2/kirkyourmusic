// Appends /v1 when the API Base URL has no version segment, e.g. https://api.example.com -> https://api.example.com/v1.
// URLs that already name a version (/v1, /api/v1, /v1beta, /v2) are kept as-is apart from trailing slashes.
export function withApiVersion(baseUrl: string): string {
    const url = new URL(baseUrl);
    const path = url.pathname.replace(/\/+$/, "");
    const hasVersion = /\/v\d+[a-z]*(\/|$)/i.test(path);
    return `${url.origin}${hasVersion ? path : `${path}/v1`}`;
}
