export declare function requireToken(): string;
export declare function epureFetch(path: string, init?: RequestInit): Promise<Response>;
export declare function epureJson(path: string, init?: RequestInit): Promise<unknown>;
/** Dashboard + agent routes a PAT may call (enforced again on server). */
export declare const API_CATALOG: string;
