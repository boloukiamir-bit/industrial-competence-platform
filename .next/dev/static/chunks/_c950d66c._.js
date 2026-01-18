(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/lib/env.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Environment variable helper with fail-fast behavior
 * Ensures Supabase credentials are always available
 */ __turbopack_context__.s([
    "getPublicEnv",
    ()=>getPublicEnv,
    "getServiceRoleKey",
    ()=>getServiceRoleKey,
    "validatePublicEnv",
    ()=>validatePublicEnv
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
// Hardcoded fallback values for production builds
const FALLBACK_SUPABASE_URL = "https://bmvawfrnlpdvcmffqrzc.supabase.co";
const FALLBACK_SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtdmF3ZnJubHBkdmNtZmZxcnpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MTEwOTAsImV4cCI6MjA4MTA4NzA5MH0.DHLJ4aMn1dORfbNPt1XrJtcdIjYN81YQbJ19Q89A_pM";
function getPublicEnv() {
    const supabaseUrl = ("TURBOPACK compile-time value", "https://bmvawfrnlpdvcmffqrzc.supabase.co") || FALLBACK_SUPABASE_URL;
    const supabaseAnonKey = ("TURBOPACK compile-time value", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtdmF3ZnJubHBkdmNtZmZxcnpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MTEwOTAsImV4cCI6MjA4MTA4NzA5MH0.DHLJ4aMn1dORfbNPt1XrJtcdIjYN81YQbJ19Q89A_pM") || FALLBACK_SUPABASE_ANON_KEY;
    const missing = [];
    if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
        missing.push('NEXT_PUBLIC_SUPABASE_URL');
    }
    if (!supabaseAnonKey || supabaseAnonKey.includes('placeholder')) {
        missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }
    if (missing.length > 0) {
        throw new Error(`Supabase env missing: ${missing.join(', ')}`);
    }
    return {
        supabaseUrl,
        supabaseAnonKey
    };
}
function validatePublicEnv() {
    const missing = [];
    const supabaseUrl = ("TURBOPACK compile-time value", "https://bmvawfrnlpdvcmffqrzc.supabase.co") || FALLBACK_SUPABASE_URL;
    const supabaseAnonKey = ("TURBOPACK compile-time value", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtdmF3ZnJubHBkdmNtZmZxcnpjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1MTEwOTAsImV4cCI6MjA4MTA4NzA5MH0.DHLJ4aMn1dORfbNPt1XrJtcdIjYN81YQbJ19Q89A_pM") || FALLBACK_SUPABASE_ANON_KEY;
    if (!supabaseUrl || supabaseUrl.includes('placeholder')) {
        missing.push('NEXT_PUBLIC_SUPABASE_URL');
    }
    if (!supabaseAnonKey || supabaseAnonKey.includes('placeholder')) {
        missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }
    return {
        valid: missing.length === 0,
        missing
    };
}
function getServiceRoleKey() {
    if ("TURBOPACK compile-time truthy", 1) {
        throw new Error('Service role key must never be accessed on the client');
    }
    const key = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key) {
        throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured');
    }
    return key;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/supabaseClient.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getSupabaseClient",
    ()=>getSupabaseClient,
    "isSupabaseReady",
    ()=>isSupabaseReady,
    "supabase",
    ()=>supabase
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$esm$2f$wrapper$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/@supabase/supabase-js/dist/esm/wrapper.mjs [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$env$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/env.ts [app-client] (ecmascript)");
;
;
let supabaseInstance = null;
function createSupabaseClient() {
    const env = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$env$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getPublicEnv"])();
    return (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f40$supabase$2f$supabase$2d$js$2f$dist$2f$esm$2f$wrapper$2e$mjs__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createClient"])(env.supabaseUrl, env.supabaseAnonKey, {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true
        }
    });
}
function getSupabaseClient() {
    if (!supabaseInstance) {
        supabaseInstance = createSupabaseClient();
    }
    return supabaseInstance;
}
const supabase = createSupabaseClient();
function isSupabaseReady() {
    const validation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$env$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["validatePublicEnv"])();
    return validation.valid;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/auth.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "canAccessEmployee",
    ()=>canAccessEmployee,
    "getCurrentUser",
    ()=>getCurrentUser,
    "getManagedEmployeeIds",
    ()=>getManagedEmployeeIds,
    "requireRole",
    ()=>requireRole
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabaseClient.ts [app-client] (ecmascript)");
;
async function getCurrentUser() {
    const devEmail = __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.NEXT_PUBLIC_DEV_USER_EMAIL || "hr@example.com";
    try {
        const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"].from("users").select("id, employee_id, email, role").eq("email", devEmail).single();
        if (error || !data) {
            return {
                id: "dev-user",
                role: "HR_ADMIN",
                email: devEmail
            };
        }
        return {
            id: data.id,
            role: data.role,
            employeeId: data.employee_id || undefined,
            email: data.email
        };
    } catch  {
        return {
            id: "dev-user",
            role: "HR_ADMIN",
            email: devEmail
        };
    }
}
function requireRole(user, allowed) {
    if (!user) {
        throw new Error("Unauthorized: User not authenticated");
    }
    if (!allowed.includes(user.role)) {
        throw new Error(`Forbidden: Role ${user.role} not allowed`);
    }
}
function canAccessEmployee(user, employeeId, managedEmployeeIds) {
    if (!user) return false;
    if (user.role === "HR_ADMIN") return true;
    if (user.role === "MANAGER") {
        return managedEmployeeIds.includes(employeeId);
    }
    if (user.role === "EMPLOYEE") {
        return user.employeeId === employeeId;
    }
    return false;
}
async function getManagedEmployeeIds(managerId) {
    const { data } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"].from("employees").select("id").eq("manager_id", managerId).eq("is_active", true);
    return (data || []).map((e)=>e.id);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/services/auth.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "getAuthUser",
    ()=>getAuthUser,
    "getSession",
    ()=>getSession,
    "onAuthStateChange",
    ()=>onAuthStateChange,
    "signInWithEmail",
    ()=>signInWithEmail,
    "signOut",
    ()=>signOut
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabaseClient.ts [app-client] (ecmascript)");
;
async function signInWithEmail(email, password) {
    const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"].auth.signInWithPassword({
        email,
        password
    });
    if (error) throw error;
    return data;
}
async function signOut() {
    const { error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"].auth.signOut();
    if (error) throw error;
}
async function getAuthUser() {
    const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"].auth.getUser();
    if (error) return null;
    return data.user;
}
async function getSession() {
    const { data, error } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"].auth.getSession();
    if (error) return null;
    return data.session;
}
function onAuthStateChange(callback) {
    return __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"].auth.onAuthStateChange(callback);
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/hooks/useAuth.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "useAuth",
    ()=>useAuth
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$services$2f$auth$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/services/auth.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
function useAuth(requireAuth = true) {
    _s();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const [user, setUser] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [loading, setLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useAuth.useEffect": ()=>{
            let mounted = true;
            async function checkAuth() {
                try {
                    const session = await (0, __TURBOPACK__imported__module__$5b$project$5d2f$services$2f$auth$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSession"])();
                    if (mounted) {
                        if (session?.user) {
                            setUser(session.user);
                        } else if (requireAuth) {
                            router.push("/login");
                        }
                    }
                } catch  {
                    if (mounted && requireAuth) {
                        router.push("/login");
                    }
                } finally{
                    if (mounted) {
                        setLoading(false);
                    }
                }
            }
            checkAuth();
            const { data: { subscription } } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$services$2f$auth$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["onAuthStateChange"])({
                "useAuth.useEffect": (event, session)=>{
                    if (mounted) {
                        const typedSession = session;
                        if (event === "SIGNED_OUT") {
                            setUser(null);
                            if (requireAuth) {
                                router.push("/login");
                            }
                        } else if (event === "SIGNED_IN" && typedSession?.user) {
                            setUser(typedSession.user);
                        }
                    }
                }
            }["useAuth.useEffect"]);
            return ({
                "useAuth.useEffect": ()=>{
                    mounted = false;
                    subscription.unsubscribe();
                }
            })["useAuth.useEffect"];
        }
    }["useAuth.useEffect"], [
        requireAuth,
        router
    ]);
    return {
        user,
        loading,
        isAuthenticated: !!user
    };
}
_s(useAuth, "BbLp2f70vSKQbLuRmNWaNGLT/n4=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"]
    ];
});
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/hooks/useOrg.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "OrgContext",
    ()=>OrgContext,
    "useOrg",
    ()=>useOrg,
    "useOrgState",
    ()=>useOrgState
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/supabaseClient.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature(), _s1 = __turbopack_context__.k.signature();
'use client';
;
;
const ORG_STORAGE_KEY = 'nadiplan_current_org';
function useOrgState() {
    _s();
    const [currentOrg, setCurrentOrg] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [currentRole, setCurrentRole] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const [memberships, setMemberships] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])([]);
    const [isLoading, setIsLoading] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(true);
    const [error, setError] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const refreshMemberships = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useOrgState.useCallback[refreshMemberships]": async ()=>{
            setIsLoading(true);
            setError(null);
            try {
                const { data: { user } } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"].auth.getUser();
                if (!user) {
                    setMemberships([]);
                    setCurrentOrg(null);
                    setCurrentRole(null);
                    setIsLoading(false);
                    return;
                }
                // Get all active memberships with org details
                const { data: membershipData, error: membershipError } = await __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$supabaseClient$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["supabase"].from('memberships').select(`
          org_id,
          user_id,
          role,
          status,
          created_at,
          organization:organizations(id, name, slug, created_at)
        `).eq('user_id', user.id).eq('status', 'active');
                if (membershipError) {
                    console.error('Error fetching memberships:', membershipError);
                    setError('Failed to load organizations');
                    setIsLoading(false);
                    return;
                }
                const formattedMemberships = (membershipData || []).map({
                    "useOrgState.useCallback[refreshMemberships].formattedMemberships": (m)=>({
                            ...m,
                            organization: Array.isArray(m.organization) ? m.organization[0] : m.organization || undefined
                        })
                }["useOrgState.useCallback[refreshMemberships].formattedMemberships"]);
                setMemberships(formattedMemberships);
                // Try to restore previously selected org
                const storedOrgId = localStorage.getItem(ORG_STORAGE_KEY);
                if (storedOrgId) {
                    const membership = formattedMemberships.find({
                        "useOrgState.useCallback[refreshMemberships].membership": (m)=>m.org_id === storedOrgId
                    }["useOrgState.useCallback[refreshMemberships].membership"]);
                    if (membership && membership.organization) {
                        setCurrentOrg(membership.organization);
                        setCurrentRole(membership.role);
                    } else if (formattedMemberships.length === 1 && formattedMemberships[0].organization) {
                        // Auto-select if only one org
                        setCurrentOrg(formattedMemberships[0].organization);
                        setCurrentRole(formattedMemberships[0].role);
                        localStorage.setItem(ORG_STORAGE_KEY, formattedMemberships[0].org_id);
                    }
                } else if (formattedMemberships.length === 1 && formattedMemberships[0].organization) {
                    // Auto-select if only one org
                    setCurrentOrg(formattedMemberships[0].organization);
                    setCurrentRole(formattedMemberships[0].role);
                    localStorage.setItem(ORG_STORAGE_KEY, formattedMemberships[0].org_id);
                }
            } catch (err) {
                console.error('Error in refreshMemberships:', err);
                setError('Failed to load organizations');
            } finally{
                setIsLoading(false);
            }
        }
    }["useOrgState.useCallback[refreshMemberships]"], []);
    const selectOrg = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useCallback"])({
        "useOrgState.useCallback[selectOrg]": (orgId)=>{
            const membership = memberships.find({
                "useOrgState.useCallback[selectOrg].membership": (m)=>m.org_id === orgId
            }["useOrgState.useCallback[selectOrg].membership"]);
            if (membership && membership.organization) {
                setCurrentOrg(membership.organization);
                setCurrentRole(membership.role);
                localStorage.setItem(ORG_STORAGE_KEY, orgId);
            }
        }
    }["useOrgState.useCallback[selectOrg]"], [
        memberships
    ]);
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "useOrgState.useEffect": ()=>{
            refreshMemberships();
        }
    }["useOrgState.useEffect"], [
        refreshMemberships
    ]);
    return {
        currentOrg,
        currentRole,
        memberships,
        isLoading,
        error,
        selectOrg,
        refreshMemberships,
        isAdmin: currentRole === 'admin'
    };
}
_s(useOrgState, "88+pHzRae7WhwCFnB4GgdU3zYWw=");
const OrgContext = /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["createContext"])(null);
function useOrg() {
    _s1();
    const context = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useContext"])(OrgContext);
    if (!context) {
        throw new Error('useOrg must be used within an OrgProvider');
    }
    return context;
}
_s1(useOrg, "b9L3QQ+jgeyIrH0NfHrJ8nn7VMU=");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/OrgProvider.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "OrgProvider",
    ()=>OrgProvider
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$hooks$2f$useOrg$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/hooks/useOrg.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
'use client';
;
function OrgProvider({ children }) {
    _s();
    const orgState = (0, __TURBOPACK__imported__module__$5b$project$5d2f$hooks$2f$useOrg$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useOrgState"])();
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$hooks$2f$useOrg$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["OrgContext"].Provider, {
        value: orgState,
        children: children
    }, void 0, false, {
        fileName: "[project]/components/OrgProvider.tsx",
        lineNumber: 14,
        columnNumber: 5
    }, this);
}
_s(OrgProvider, "PXasx9NgRWJOEJMEx1/Bv9iSOAw=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$hooks$2f$useOrg$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useOrgState"]
    ];
});
_c = OrgProvider;
var _c;
__turbopack_context__.k.register(_c, "OrgProvider");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/demoData.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DEMO_EMPLOYEES",
    ()=>DEMO_EMPLOYEES,
    "DEMO_EMPLOYEE_SKILLS",
    ()=>DEMO_EMPLOYEE_SKILLS,
    "DEMO_ORG_UNITS",
    ()=>DEMO_ORG_UNITS,
    "DEMO_POSITIONS",
    ()=>DEMO_POSITIONS,
    "DEMO_REQUIREMENTS",
    ()=>DEMO_REQUIREMENTS,
    "DEMO_SKILLS",
    ()=>DEMO_SKILLS,
    "getDemoMetrics",
    ()=>getDemoMetrics,
    "isDemoMode",
    ()=>isDemoMode
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
const DEMO_EMPLOYEES = [
    {
        id: "E1001",
        employeeNumber: "E1001",
        name: "Anna Lindberg",
        firstName: "Anna",
        lastName: "Lindberg",
        email: "anna.lindberg@example.com",
        role: "Operator",
        line: "Pressline 1",
        team: "Day Shift",
        startDate: "2020-03-15",
        isActive: true
    },
    {
        id: "E1002",
        employeeNumber: "E1002",
        name: "Erik Johansson",
        firstName: "Erik",
        lastName: "Johansson",
        email: "erik.johansson@example.com",
        role: "Operator",
        line: "Pressline 1",
        team: "Day Shift",
        startDate: "2019-06-01",
        isActive: true
    },
    {
        id: "E1003",
        employeeNumber: "E1003",
        name: "Maria Svensson",
        firstName: "Maria",
        lastName: "Svensson",
        email: "maria.svensson@example.com",
        role: "Team Lead",
        line: "Pressline 1",
        team: "Day Shift",
        startDate: "2018-01-10",
        isActive: true
    },
    {
        id: "E1004",
        employeeNumber: "E1004",
        name: "Karl Andersson",
        firstName: "Karl",
        lastName: "Andersson",
        email: "karl.andersson@example.com",
        role: "Operator",
        line: "Pressline 1",
        team: "Night Shift",
        startDate: "2021-09-20",
        isActive: true
    },
    {
        id: "E1005",
        employeeNumber: "E1005",
        name: "Sofia Nilsson",
        firstName: "Sofia",
        lastName: "Nilsson",
        email: "sofia.nilsson@example.com",
        role: "Operator",
        line: "Pressline 2",
        team: "Day Shift",
        startDate: "2022-02-14",
        isActive: true
    },
    {
        id: "E1006",
        employeeNumber: "E1006",
        name: "Lars Pettersson",
        firstName: "Lars",
        lastName: "Pettersson",
        email: "lars.pettersson@example.com",
        role: "Team Lead",
        line: "Pressline 2",
        team: "Day Shift",
        startDate: "2017-05-22",
        isActive: true
    },
    {
        id: "E1007",
        employeeNumber: "E1007",
        name: "Emma Gustafsson",
        firstName: "Emma",
        lastName: "Gustafsson",
        email: "emma.gustafsson@example.com",
        role: "Quality Inspector",
        line: "Quality Control",
        team: "Day Shift",
        startDate: "2020-11-03",
        isActive: true
    },
    {
        id: "E1008",
        employeeNumber: "E1008",
        name: "Oscar Eriksson",
        firstName: "Oscar",
        lastName: "Eriksson",
        email: "oscar.eriksson@example.com",
        role: "Operator",
        line: "Assembly",
        team: "Day Shift",
        startDate: "2021-04-18",
        isActive: true
    },
    {
        id: "E1009",
        employeeNumber: "E1009",
        name: "Maja Larsson",
        firstName: "Maja",
        lastName: "Larsson",
        email: "maja.larsson@example.com",
        role: "Operator",
        line: "Assembly",
        team: "Night Shift",
        startDate: "2019-08-25",
        isActive: true
    },
    {
        id: "E1010",
        employeeNumber: "E1010",
        name: "Viktor Olsson",
        firstName: "Viktor",
        lastName: "Olsson",
        email: "viktor.olsson@example.com",
        role: "Logistics Coordinator",
        line: "Logistics",
        team: "Day Shift",
        startDate: "2018-12-01",
        isActive: true
    }
];
const DEMO_SKILLS = [
    {
        id: "SK001",
        code: "PRESS_A",
        name: "Pressline A Operation",
        groupId: "G1",
        groupName: "Production"
    },
    {
        id: "SK002",
        code: "PRESS_B",
        name: "Pressline B Operation",
        groupId: "G1",
        groupName: "Production"
    },
    {
        id: "SK003",
        code: "SAFETY_BASIC",
        name: "Safety Basic",
        groupId: "G2",
        groupName: "Safety"
    },
    {
        id: "SK004",
        code: "SAFETY_ADV",
        name: "Safety Advanced",
        groupId: "G2",
        groupName: "Safety"
    },
    {
        id: "SK005",
        code: "TRUCK_A1",
        name: "Truck A1 License",
        groupId: "G3",
        groupName: "Certifications"
    },
    {
        id: "SK006",
        code: "TRUCK_B1",
        name: "Truck B1 License",
        groupId: "G3",
        groupName: "Certifications"
    },
    {
        id: "SK007",
        code: "QUALITY_INSP",
        name: "Quality Inspection",
        groupId: "G4",
        groupName: "Quality"
    },
    {
        id: "SK008",
        code: "FIRST_AID",
        name: "First Aid Certified",
        groupId: "G2",
        groupName: "Safety"
    }
];
const DEMO_POSITIONS = [
    {
        id: "P1",
        name: "Pressline 1 Operator",
        line: "Pressline 1",
        minHeadcount: 4
    },
    {
        id: "P2",
        name: "Pressline 2 Operator",
        line: "Pressline 2",
        minHeadcount: 3
    },
    {
        id: "P3",
        name: "Assembly Operator",
        line: "Assembly",
        minHeadcount: 3
    },
    {
        id: "P4",
        name: "Quality Inspector",
        line: "Quality Control",
        minHeadcount: 2
    },
    {
        id: "P5",
        name: "Logistics Coordinator",
        line: "Logistics",
        minHeadcount: 2
    }
];
const DEMO_ORG_UNITS = [
    {
        id: "OU1",
        name: "Manufacturing Division",
        code: "MFG",
        type: "Division",
        parentId: null,
        employeeCount: 10
    },
    {
        id: "OU2",
        name: "Pressline Department",
        code: "PRESS",
        type: "Department",
        parentId: "OU1",
        employeeCount: 6
    },
    {
        id: "OU3",
        name: "Assembly Department",
        code: "ASSY",
        type: "Department",
        parentId: "OU1",
        employeeCount: 2
    },
    {
        id: "OU4",
        name: "Quality Department",
        code: "QC",
        type: "Department",
        parentId: "OU1",
        employeeCount: 1
    },
    {
        id: "OU5",
        name: "Logistics Department",
        code: "LOG",
        type: "Department",
        parentId: "OU1",
        employeeCount: 1
    }
];
const DEMO_REQUIREMENTS = [
    {
        positionId: "P1",
        skillId: "SK001",
        requiredLevel: 3
    },
    {
        positionId: "P1",
        skillId: "SK002",
        requiredLevel: 2
    },
    {
        positionId: "P1",
        skillId: "SK003",
        requiredLevel: 3
    },
    {
        positionId: "P1",
        skillId: "SK005",
        requiredLevel: 2
    },
    {
        positionId: "P2",
        skillId: "SK001",
        requiredLevel: 2
    },
    {
        positionId: "P2",
        skillId: "SK002",
        requiredLevel: 3
    },
    {
        positionId: "P2",
        skillId: "SK003",
        requiredLevel: 3
    },
    {
        positionId: "P3",
        skillId: "SK003",
        requiredLevel: 2
    },
    {
        positionId: "P3",
        skillId: "SK008",
        requiredLevel: 2
    },
    {
        positionId: "P4",
        skillId: "SK007",
        requiredLevel: 4
    },
    {
        positionId: "P4",
        skillId: "SK003",
        requiredLevel: 3
    },
    {
        positionId: "P5",
        skillId: "SK005",
        requiredLevel: 3
    },
    {
        positionId: "P5",
        skillId: "SK006",
        requiredLevel: 2
    }
];
const DEMO_EMPLOYEE_SKILLS = [
    {
        employeeId: "E1001",
        skillId: "SK001",
        level: 4
    },
    {
        employeeId: "E1001",
        skillId: "SK002",
        level: 2
    },
    {
        employeeId: "E1001",
        skillId: "SK003",
        level: 3
    },
    {
        employeeId: "E1001",
        skillId: "SK005",
        level: 1
    },
    {
        employeeId: "E1002",
        skillId: "SK001",
        level: 3
    },
    {
        employeeId: "E1002",
        skillId: "SK002",
        level: 1
    },
    {
        employeeId: "E1002",
        skillId: "SK003",
        level: 2
    },
    {
        employeeId: "E1002",
        skillId: "SK005",
        level: 0
    },
    {
        employeeId: "E1003",
        skillId: "SK001",
        level: 4
    },
    {
        employeeId: "E1003",
        skillId: "SK002",
        level: 4
    },
    {
        employeeId: "E1003",
        skillId: "SK003",
        level: 4
    },
    {
        employeeId: "E1003",
        skillId: "SK005",
        level: 3
    },
    {
        employeeId: "E1004",
        skillId: "SK001",
        level: 2
    },
    {
        employeeId: "E1004",
        skillId: "SK002",
        level: 0
    },
    {
        employeeId: "E1004",
        skillId: "SK003",
        level: 1
    },
    {
        employeeId: "E1004",
        skillId: "SK005",
        level: 2
    },
    {
        employeeId: "E1005",
        skillId: "SK001",
        level: 2
    },
    {
        employeeId: "E1005",
        skillId: "SK002",
        level: 3
    },
    {
        employeeId: "E1005",
        skillId: "SK003",
        level: 3
    },
    {
        employeeId: "E1006",
        skillId: "SK001",
        level: 3
    },
    {
        employeeId: "E1006",
        skillId: "SK002",
        level: 4
    },
    {
        employeeId: "E1006",
        skillId: "SK003",
        level: 4
    },
    {
        employeeId: "E1007",
        skillId: "SK007",
        level: 4
    },
    {
        employeeId: "E1007",
        skillId: "SK003",
        level: 3
    },
    {
        employeeId: "E1008",
        skillId: "SK003",
        level: 2
    },
    {
        employeeId: "E1008",
        skillId: "SK008",
        level: 2
    },
    {
        employeeId: "E1009",
        skillId: "SK003",
        level: 3
    },
    {
        employeeId: "E1009",
        skillId: "SK008",
        level: 3
    },
    {
        employeeId: "E1010",
        skillId: "SK005",
        level: 4
    },
    {
        employeeId: "E1010",
        skillId: "SK006",
        level: 3
    }
];
function isDemoMode() {
    if ("TURBOPACK compile-time truthy", 1) {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get("demo") === "true") return true;
    }
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.NEXT_PUBLIC_DEMO_MODE === "true";
}
function getDemoMetrics() {
    const employeesAtRisk = 3;
    const totalGaps = 5;
    const criticalGaps = 2;
    return {
        totalEmployees: DEMO_EMPLOYEES.length,
        activeEmployees: DEMO_EMPLOYEES.filter((e)=>e.isActive).length,
        totalSkills: DEMO_SKILLS.length,
        totalPositions: DEMO_POSITIONS.length,
        totalOrgUnits: DEMO_ORG_UNITS.length,
        employeesAtRisk,
        totalGaps,
        criticalGaps,
        topGapSkill: "Truck A1 License",
        averageReadiness: 78
    };
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/demoRuntime.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DEMO_CHECKLIST",
    ()=>DEMO_CHECKLIST,
    "disableDemoMode",
    ()=>disableDemoMode,
    "enableDemoMode",
    ()=>enableDemoMode,
    "getDemoEmployeeSkills",
    ()=>getDemoEmployeeSkills,
    "getDemoEmployees",
    ()=>getDemoEmployees,
    "getDemoEvents",
    ()=>getDemoEvents,
    "getDemoGaps",
    ()=>getDemoGaps,
    "getDemoMetrics",
    ()=>getDemoMetrics,
    "getDemoOrg",
    ()=>getDemoOrg,
    "getDemoOrgUnits",
    ()=>getDemoOrgUnits,
    "getDemoPositions",
    ()=>getDemoPositions,
    "getDemoRequirements",
    ()=>getDemoRequirements,
    "getDemoScript",
    ()=>getDemoScript,
    "getDemoSkills",
    ()=>getDemoSkills,
    "isDemoMode",
    ()=>isDemoMode
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$demoData$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/demoData.ts [app-client] (ecmascript)");
"use client";
;
const DEMO_ORG = {
    id: "demo-org-001",
    name: "Nadiplan Demo Manufacturing",
    slug: "nadiplan-demo",
    createdAt: "2024-01-01T00:00:00Z"
};
function isDemoMode() {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("demo") === "1" || urlParams.get("demo") === "true") {
        sessionStorage.setItem("nadiplan_demo_mode", "true");
        return true;
    }
    if (sessionStorage.getItem("nadiplan_demo_mode") === "true") {
        return true;
    }
    return __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"].env.NEXT_PUBLIC_DEMO_MODE === "true";
}
function enableDemoMode() {
    if ("TURBOPACK compile-time truthy", 1) {
        sessionStorage.setItem("nadiplan_demo_mode", "true");
    }
}
function disableDemoMode() {
    if ("TURBOPACK compile-time truthy", 1) {
        sessionStorage.removeItem("nadiplan_demo_mode");
    }
}
function getDemoOrg() {
    return DEMO_ORG;
}
function getDemoEmployees() {
    return __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$demoData$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEMO_EMPLOYEES"].map((e)=>({
            id: e.id,
            name: e.name,
            firstName: e.firstName,
            lastName: e.lastName,
            email: e.email,
            employeeNumber: e.employeeNumber,
            role: e.role,
            line: e.line,
            team: e.team,
            employmentType: "permanent",
            startDate: e.startDate,
            isActive: e.isActive
        }));
}
function getDemoSkills() {
    return __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$demoData$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEMO_SKILLS"].map((s)=>({
            id: s.id,
            code: s.code,
            name: s.name,
            category: s.groupName,
            description: `${s.name} skill for industrial operations`
        }));
}
function getDemoPositions() {
    return __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$demoData$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEMO_POSITIONS"].map((p)=>({
            id: p.id,
            name: p.name,
            line: p.line,
            minHeadcount: p.minHeadcount
        }));
}
function getDemoOrgUnits() {
    return __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$demoData$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEMO_ORG_UNITS"].map((u)=>({
            id: u.id,
            name: u.name,
            code: u.code,
            type: u.type.toLowerCase(),
            parentId: u.parentId || undefined,
            createdAt: "2024-01-01T00:00:00Z",
            employeeCount: u.employeeCount
        }));
}
function getDemoRequirements() {
    return __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$demoData$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEMO_REQUIREMENTS"].map((r)=>({
            positionId: r.positionId,
            positionName: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$demoData$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEMO_POSITIONS"].find((p)=>p.id === r.positionId)?.name || "",
            skillId: r.skillId,
            skillName: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$demoData$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEMO_SKILLS"].find((s)=>s.id === r.skillId)?.name || "",
            requiredLevel: r.requiredLevel
        }));
}
function getDemoEmployeeSkills() {
    return __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$demoData$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEMO_EMPLOYEE_SKILLS"].map((es)=>({
            employeeId: es.employeeId,
            skillId: es.skillId,
            level: es.level,
            skillName: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$demoData$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEMO_SKILLS"].find((s)=>s.id === es.skillId)?.name || "",
            skillCode: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$demoData$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DEMO_SKILLS"].find((s)=>s.id === es.skillId)?.code || ""
        }));
}
function getDemoGaps() {
    const gaps = [];
    const employees = getDemoEmployees();
    const employeeSkills = getDemoEmployeeSkills();
    const requirements = getDemoRequirements();
    const positions = getDemoPositions();
    for (const req of requirements){
        const position = positions.find((p)=>p.id === req.positionId);
        if (!position) continue;
        const employeesInLine = employees.filter((e)=>e.line === position.line && e.isActive);
        let totalLevel = 0;
        let missingCount = 0;
        for (const emp of employeesInLine){
            const skill = employeeSkills.find((es)=>es.employeeId === emp.id && es.skillId === req.skillId);
            const level = skill?.level || 0;
            totalLevel += level;
            if (level < req.requiredLevel) {
                missingCount++;
            }
        }
        const avgLevel = employeesInLine.length > 0 ? totalLevel / employeesInLine.length : 0;
        if (missingCount > 0) {
            gaps.push({
                line: position.line,
                team: null,
                role: position.name,
                skillName: req.skillName,
                skillId: req.skillId,
                requiredLevel: req.requiredLevel,
                currentAvgLevel: Math.round(avgLevel * 10) / 10,
                missingCount
            });
        }
    }
    return gaps.sort((a, b)=>b.missingCount - a.missingCount);
}
function getDemoMetrics() {
    const employees = getDemoEmployees();
    const gaps = getDemoGaps();
    const activeEmployees = employees.filter((e)=>e.isActive);
    const atRiskCount = gaps.reduce((acc, g)=>acc + g.missingCount, 0);
    const topGapSkill = gaps[0]?.skillName || "None";
    const totalSkillAssessments = getDemoEmployeeSkills().length;
    const avgReadiness = totalSkillAssessments > 0 ? Math.round(getDemoEmployeeSkills().reduce((acc, s)=>acc + s.level, 0) / (totalSkillAssessments * 4) * 100) : 0;
    return {
        totalEmployees: activeEmployees.length,
        atRiskCount,
        topGapSkill,
        avgReadiness,
        totalPositions: getDemoPositions().length,
        totalSkills: getDemoSkills().length,
        totalOrgUnits: getDemoOrgUnits().length,
        gapCount: gaps.length
    };
}
function getDemoEvents() {
    const employees = getDemoEmployees();
    const today = new Date();
    const addDays = (date, days)=>{
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result.toISOString().slice(0, 10);
    };
    return [
        {
            id: "evt-001",
            employeeId: employees[0]?.id || "E1001",
            employeeName: employees[0]?.name || "Anna Lindberg",
            category: "certification",
            title: "Forklift License Renewal",
            description: "Annual forklift operator certification renewal",
            dueDate: addDays(today, -5),
            completedDate: undefined,
            recurrence: "12m",
            ownerManagerId: "mgr-001",
            status: "overdue",
            notes: ""
        },
        {
            id: "evt-002",
            employeeId: employees[1]?.id || "E1002",
            employeeName: employees[1]?.name || "Erik Johansson",
            category: "safety",
            title: "Safety Training",
            description: "Mandatory annual safety training",
            dueDate: addDays(today, 15),
            completedDate: undefined,
            recurrence: "12m",
            ownerManagerId: "mgr-001",
            status: "due_soon",
            notes: ""
        },
        {
            id: "evt-003",
            employeeId: employees[2]?.id || "E1003",
            employeeName: employees[2]?.name || "Maria Svensson",
            category: "review",
            title: "Performance Review",
            description: "Annual performance review",
            dueDate: addDays(today, 45),
            completedDate: undefined,
            recurrence: "12m",
            ownerManagerId: "mgr-001",
            status: "due_soon",
            notes: ""
        },
        {
            id: "evt-004",
            employeeId: employees[3]?.id || "E1004",
            employeeName: employees[3]?.name || "Karl Andersson",
            category: "onboarding",
            title: "90-Day Check-in",
            description: "New employee 90-day review",
            dueDate: addDays(today, 90),
            completedDate: undefined,
            recurrence: undefined,
            ownerManagerId: "mgr-001",
            status: "upcoming",
            notes: ""
        }
    ];
}
function getDemoScript() {
    return `NADIPLAN DEMO SCRIPT
====================

1. DASHBOARD
   - Show key metrics: employees, at-risk count, readiness percentage
   - Highlight the top gap skill that needs attention

2. EMPLOYEES
   - Browse the employee list
   - Click "Add Employee" to show the form
   - Click "Import CSV" to demonstrate bulk import

3. ORGANIZATION OVERVIEW
   - Show the org hierarchy tree
   - Click "Create Unit" to add departments

4. COMPETENCE MATRIX
   - Show skill levels across employees
   - Point out OK/GAP/RISK status badges
   - Click "Export CSV" to download data

5. TOMORROW'S GAPS
   - Click "Generate" to analyze skill gaps
   - Show the summary: top missing skills
   - Review the gaps table with severity
   - Export gaps report as CSV

6. WRAP-UP
   - Navigate back to Dashboard
   - Mention CTA: "Start Your Free Trial"
`;
}
const DEMO_CHECKLIST = [
    {
        step: 1,
        title: "Dashboard",
        description: "Verify metrics show non-zero values"
    },
    {
        step: 2,
        title: "Employees",
        description: "List shows 10 employees, buttons visible"
    },
    {
        step: 3,
        title: "Organization",
        description: "Org tree displays 5 units"
    },
    {
        step: 4,
        title: "Competence Matrix",
        description: "Matrix shows skills with status badges"
    },
    {
        step: 5,
        title: "Tomorrow's Gaps",
        description: "Generate shows summary and table"
    },
    {
        step: 6,
        title: "Export",
        description: "CSV download works on Matrix and Gaps"
    }
];
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/DemoModeBanner.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "DemoModeBanner",
    ()=>DemoModeBanner
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Shield$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/shield.js [app-client] (ecmascript) <export default as Shield>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$external$2d$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ExternalLink$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/external-link.js [app-client] (ecmascript) <export default as ExternalLink>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$demoRuntime$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/demoRuntime.ts [app-client] (ecmascript)");
"use client";
;
;
;
;
function DemoModeBanner() {
    const demoEnabled = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$demoRuntime$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["isDemoMode"])();
    if (!demoEnabled) return null;
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
        className: "bg-blue-600 dark:bg-blue-700 text-white px-4 py-2",
        "data-testid": "banner-demo-mode",
        children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "flex items-center justify-center gap-3 text-sm",
            children: [
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Shield$3e$__["Shield"], {
                    className: "h-4 w-4"
                }, void 0, false, {
                    fileName: "[project]/components/DemoModeBanner.tsx",
                    lineNumber: 18,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "font-medium",
                    children: "Demo Mode Active"
                }, void 0, false, {
                    fileName: "[project]/components/DemoModeBanner.tsx",
                    lineNumber: 19,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "opacity-80",
                    children: "Viewing pre-configured demo data"
                }, void 0, false, {
                    fileName: "[project]/components/DemoModeBanner.tsx",
                    lineNumber: 20,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                    className: "opacity-50",
                    children: "|"
                }, void 0, false, {
                    fileName: "[project]/components/DemoModeBanner.tsx",
                    lineNumber: 21,
                    columnNumber: 9
                }, this),
                /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                    href: "/app/demo-center",
                    className: "flex items-center gap-1 underline hover:no-underline",
                    "data-testid": "link-demo-center",
                    children: [
                        /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$external$2d$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ExternalLink$3e$__["ExternalLink"], {
                            className: "h-3 w-3"
                        }, void 0, false, {
                            fileName: "[project]/components/DemoModeBanner.tsx",
                            lineNumber: 27,
                            columnNumber: 11
                        }, this),
                        "Demo Center"
                    ]
                }, void 0, true, {
                    fileName: "[project]/components/DemoModeBanner.tsx",
                    lineNumber: 22,
                    columnNumber: 9
                }, this)
            ]
        }, void 0, true, {
            fileName: "[project]/components/DemoModeBanner.tsx",
            lineNumber: 17,
            columnNumber: 7
        }, this)
    }, void 0, false, {
        fileName: "[project]/components/DemoModeBanner.tsx",
        lineNumber: 13,
        columnNumber: 5
    }, this);
}
_c = DemoModeBanner;
var _c;
__turbopack_context__.k.register(_c, "DemoModeBanner");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/debugStore.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "clearErrors",
    ()=>clearErrors,
    "getState",
    ()=>getState,
    "logApiCall",
    ()=>logApiCall,
    "logDebugError",
    ()=>logDebugError,
    "resetFlags",
    ()=>resetFlags,
    "setFlag",
    ()=>setFlag,
    "subscribe",
    ()=>subscribe
]);
const MAX_ERRORS = 50;
const MAX_API_CALLS = 10;
let state = {
    errors: [],
    flags: {
        rlsBlocked: false,
        orgMissing: false,
        loadingTimeout: false
    },
    lastApiCalls: []
};
const listeners = new Set();
function notify() {
    listeners.forEach((fn)=>fn({
            ...state
        }));
}
function subscribe(listener) {
    listeners.add(listener);
    listener({
        ...state
    });
    return ()=>listeners.delete(listener);
}
function getState() {
    return {
        ...state
    };
}
function logDebugError(error) {
    const entry = {
        ...error,
        timestamp: new Date().toISOString()
    };
    state = {
        ...state,
        errors: [
            entry,
            ...state.errors
        ].slice(0, MAX_ERRORS)
    };
    if (error.type === 'supabase' && (error.message?.toLowerCase().includes('permission denied') || error.message?.toLowerCase().includes('rls') || error.code === 'PGRST301' || error.code === '42501')) {
        state = {
            ...state,
            flags: {
                ...state.flags,
                rlsBlocked: true
            }
        };
    }
    notify();
}
function logApiCall(endpoint, status) {
    const entry = {
        endpoint,
        status,
        timestamp: new Date().toISOString()
    };
    state = {
        ...state,
        lastApiCalls: [
            entry,
            ...state.lastApiCalls
        ].slice(0, MAX_API_CALLS)
    };
    notify();
}
function setFlag(flag, value) {
    state = {
        ...state,
        flags: {
            ...state.flags,
            [flag]: value
        }
    };
    notify();
}
function clearErrors() {
    state = {
        ...state,
        errors: []
    };
    notify();
}
function resetFlags() {
    state = {
        ...state,
        flags: {
            rlsBlocked: false,
            orgMissing: false,
            loadingTimeout: false
        }
    };
    notify();
}
if ("TURBOPACK compile-time truthy", 1) {
    window.__debugStore = getState;
}
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/components/GlobalErrorHandler.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "GlobalErrorHandler",
    ()=>GlobalErrorHandler
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$debugStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/debugStore.ts [app-client] (ecmascript)");
var _s = __turbopack_context__.k.signature();
'use client';
;
;
function GlobalErrorHandler() {
    _s();
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "GlobalErrorHandler.useEffect": ()=>{
            function handleError(event) {
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$debugStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["logDebugError"])({
                    type: 'client',
                    message: event.message || 'Unknown error',
                    stack: event.error?.stack
                });
            }
            function handleRejection(event) {
                const reason = event.reason;
                let message = 'Unhandled promise rejection';
                let stack;
                if (reason instanceof Error) {
                    message = reason.message;
                    stack = reason.stack;
                } else if (typeof reason === 'string') {
                    message = reason;
                }
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$debugStore$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["logDebugError"])({
                    type: 'client',
                    message,
                    stack
                });
            }
            window.addEventListener('error', handleError);
            window.addEventListener('unhandledrejection', handleRejection);
            return ({
                "GlobalErrorHandler.useEffect": ()=>{
                    window.removeEventListener('error', handleError);
                    window.removeEventListener('unhandledrejection', handleRejection);
                }
            })["GlobalErrorHandler.useEffect"];
        }
    }["GlobalErrorHandler.useEffect"], []);
    return null;
}
_s(GlobalErrorHandler, "OD7bBpZva5O2jO+Puf00hKivP7c=");
_c = GlobalErrorHandler;
var _c;
__turbopack_context__.k.register(_c, "GlobalErrorHandler");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/copy.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "COPY",
    ()=>COPY
]);
const COPY = {
    emptyStates: {
        employees: {
            title: "No employees yet",
            description: "Get started by importing employees from a CSV file or adding them manually."
        },
        organization: {
            title: "No organization units defined",
            description: "Create your first organization unit to structure your company."
        },
        competenceMatrix: {
            noRequirements: {
                title: "No requirements defined",
                description: "Define position requirements to see skill gaps and risk levels."
            },
            noEmployees: {
                title: "No employees found",
                description: "Add employees to see the competence matrix."
            }
        },
        gaps: {
            noRequirements: {
                title: "Cannot calculate gaps",
                description: "Define position requirements first to identify skill gaps."
            },
            noEmployees: {
                title: "No employees to analyze",
                description: "Add employees before generating gap analysis."
            },
            noGaps: {
                title: "No skill gaps found",
                description: "All employees meet the position requirements."
            }
        },
        risks: {
            empty: {
                title: "No events to display",
                description: "The system will automatically create events based on employment data."
            }
        }
    },
    actions: {
        importCsv: "Import CSV",
        addEmployee: "Add Employee",
        createUnit: "Create Unit",
        importOrgStructure: "Import Org Structure (CSV)",
        editRequirements: "Edit Requirements",
        exportCsv: "Export CSV",
        defineRequirements: "Define Requirements",
        goToSetup: "Go to Setup",
        generateGaps: "Generate Gaps"
    },
    setup: {
        title: "Setup Progress",
        description: "Complete these steps to get the most out of your platform.",
        steps: {
            orgUnit: {
                title: "Create at least 1 Organization Unit",
                button: "Create Unit"
            },
            employees: {
                title: "Add employees (at least 1)",
                buttonPrimary: "Import CSV",
                buttonSecondary: "Add Employee"
            },
            skills: {
                title: "Create skills (at least 3)",
                button: "Add Skills"
            },
            positions: {
                title: "Create position with requirements",
                button: "Define Requirements"
            },
            gaps: {
                title: "Generate Tomorrow's Gaps once",
                button: "Generate Gaps"
            }
        },
        complete: "Setup complete"
    },
    nav: {
        core: "Core",
        comingSoon: "Coming Soon"
    },
    sections: {
        overdue: "Overdue",
        dueSoon: "Due Soon",
        upcoming: "Upcoming"
    }
};
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/lib/spaliDevMode.ts [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "SPALJISTEN_ORG_ID",
    ()=>SPALJISTEN_ORG_ID,
    "getSpaliDevMode",
    ()=>getSpaliDevMode
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$build$2f$polyfills$2f$process$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = /*#__PURE__*/ __turbopack_context__.i("[project]/node_modules/next/dist/build/polyfills/process.js [app-client] (ecmascript)");
function getSpaliDevMode() {
    if ("TURBOPACK compile-time falsy", 0) //TURBOPACK unreachable
    ;
    return ("TURBOPACK compile-time value", "true") === "true";
}
const SPALJISTEN_ORG_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
"[project]/app/app/layout.tsx [app-client] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "default",
    ()=>AppLayout
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/jsx-dev-runtime.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/client/app-dir/link.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/navigation.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/react/index.js [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$layout$2d$dashboard$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LayoutDashboard$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/layout-dashboard.js [app-client] (ecmascript) <export default as LayoutDashboard>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$grid$2d$3x3$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Grid3X3$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/grid-3x3.js [app-client] (ecmascript) <export default as Grid3X3>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$upload$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Upload$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/upload.js [app-client] (ecmascript) <export default as Upload>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$users$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Users$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/users.js [app-client] (ecmascript) <export default as Users>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$settings$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Settings$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/settings.js [app-client] (ecmascript) <export default as Settings>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ShieldAlert$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/shield-alert.js [app-client] (ecmascript) <export default as ShieldAlert>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$package$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Package$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/package.js [app-client] (ecmascript) <export default as Package>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$newspaper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Newspaper$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/newspaper.js [app-client] (ecmascript) <export default as Newspaper>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/file-text.js [app-client] (ecmascript) <export default as FileText>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$book$2d$open$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__BookOpen$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/book-open.js [app-client] (ecmascript) <export default as BookOpen>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Shield$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/shield.js [app-client] (ecmascript) <export default as Shield>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$building$2d$2$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Building2$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/building-2.js [app-client] (ecmascript) <export default as Building2>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chart$2d$column$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__BarChart3$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/chart-column.js [app-client] (ecmascript) <export default as BarChart3>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$workflow$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Workflow$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/workflow.js [app-client] (ecmascript) <export default as Workflow>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$log$2d$out$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LogOut$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/log-out.js [app-client] (ecmascript) <export default as LogOut>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wrench$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Wrench$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/wrench.js [app-client] (ecmascript) <export default as Wrench>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trending$2d$up$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__TrendingUp$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/trending-up.js [app-client] (ecmascript) <export default as TrendingUp>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$clipboard$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Clipboard$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/clipboard.js [app-client] (ecmascript) <export default as Clipboard>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$bug$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Bug$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/bug.js [app-client] (ecmascript) <export default as Bug>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$gauge$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Gauge$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/gauge.js [app-client] (ecmascript) <export default as Gauge>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$factory$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Factory$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/factory.js [app-client] (ecmascript) <export default as Factory>");
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$target$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Target$3e$__ = __turbopack_context__.i("[project]/node_modules/lucide-react/dist/esm/icons/target.js [app-client] (ecmascript) <export default as Target>");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$auth$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/auth.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$hooks$2f$useAuth$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/hooks/useAuth.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$services$2f$auth$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/services/auth.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$OrgProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/OrgProvider.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$DemoModeBanner$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/DemoModeBanner.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$components$2f$GlobalErrorHandler$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/components/GlobalErrorHandler.tsx [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/copy.ts [app-client] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$spaliDevMode$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/lib/spaliDevMode.ts [app-client] (ecmascript)");
;
var _s = __turbopack_context__.k.signature();
"use client";
;
;
;
;
;
;
;
;
;
;
;
;
const coreNavItems = [
    {
        name: "Cockpit",
        href: "/app/cockpit",
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$gauge$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Gauge$3e$__["Gauge"]
    },
    {
        name: "Line Overview",
        href: "/app/line-overview",
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$factory$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Factory$3e$__["Factory"]
    },
    {
        name: "Dashboard",
        href: "/app/dashboard",
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$layout$2d$dashboard$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LayoutDashboard$3e$__["LayoutDashboard"]
    },
    {
        name: "Employees",
        href: "/app/employees",
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$users$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Users$3e$__["Users"]
    },
    {
        name: "Organization",
        href: "/app/org/overview",
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$building$2d$2$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Building2$3e$__["Building2"]
    },
    {
        name: "Competence Matrix",
        href: "/app/competence-matrix",
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$grid$2d$3x3$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Grid3X3$3e$__["Grid3X3"]
    },
    {
        name: "Tomorrow's Gaps",
        href: "/app/gaps",
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$trending$2d$up$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__TrendingUp$3e$__["TrendingUp"]
    },
    {
        name: "Setup",
        href: "/app/setup",
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$clipboard$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Clipboard$3e$__["Clipboard"]
    },
    {
        name: "Admin",
        href: "/app/admin",
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$wrench$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Wrench$3e$__["Wrench"],
        hrAdminOnly: true
    }
];
const hrNavItems = [
    {
        name: "Manager Risks",
        href: "/app/manager/risks",
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2d$alert$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__ShieldAlert$3e$__["ShieldAlert"]
    },
    {
        name: "HR Analytics",
        href: "/app/hr/analytics",
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$chart$2d$column$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__BarChart3$3e$__["BarChart3"],
        hrAdminOnly: true
    },
    {
        name: "HR Workflows",
        href: "/app/workflows/templates",
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$workflow$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Workflow$3e$__["Workflow"],
        hrAdminOnly: true
    },
    {
        name: "Import Employees",
        href: "/app/import-employees",
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$upload$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Upload$3e$__["Upload"],
        hrAdminOnly: true
    }
];
const moreNavItems = [
    {
        name: "Safety / Certificates",
        href: "/app/safety/certificates",
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$shield$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Shield$3e$__["Shield"]
    },
    {
        name: "Equipment",
        href: "/app/equipment",
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$package$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Package$3e$__["Package"]
    },
    {
        name: "Handbooks",
        href: "/app/handbooks",
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$book$2d$open$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__BookOpen$3e$__["BookOpen"]
    },
    {
        name: "Documents",
        href: "/app/documents",
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$file$2d$text$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__FileText$3e$__["FileText"]
    },
    {
        name: "News",
        href: "/app/news",
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$newspaper$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Newspaper$3e$__["Newspaper"]
    }
];
const spaljistenNavItems = [
    {
        name: "SP Dashboard",
        href: "/app/spaljisten/dashboard",
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$target$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Target$3e$__["Target"]
    },
    {
        name: "SP Import",
        href: "/app/spaljisten/import",
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$upload$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Upload$3e$__["Upload"]
    }
];
const settingsNavItems = [
    {
        name: "Settings",
        href: "/app/settings",
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$settings$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Settings$3e$__["Settings"]
    },
    {
        name: "Debug",
        href: "/app/debug",
        icon: __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$bug$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__Bug$3e$__["Bug"]
    }
];
function AppLayout({ children }) {
    _s();
    const pathname = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePathname"])();
    const router = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"])();
    const { user: authUser, loading: authLoading, isAuthenticated } = (0, __TURBOPACK__imported__module__$5b$project$5d2f$hooks$2f$useAuth$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"])(true);
    const [user, setUser] = (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useState"])(null);
    const isDevMode = (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$spaliDevMode$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getSpaliDevMode"])();
    const isSpaljistenPage = pathname?.startsWith("/app/spaljisten");
    (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$index$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useEffect"])({
        "AppLayout.useEffect": ()=>{
            if (isAuthenticated) {
                (0, __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$auth$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["getCurrentUser"])().then(setUser);
            }
        }
    }["AppLayout.useEffect"], [
        isAuthenticated
    ]);
    async function handleSignOut() {
        try {
            await (0, __TURBOPACK__imported__module__$5b$project$5d2f$services$2f$auth$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["signOut"])();
            router.push("/login");
        } catch (err) {
            console.error("Sign out failed:", err);
        }
    }
    if (authLoading) {
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
            className: "flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900",
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "text-gray-500 dark:text-gray-400",
                children: "Loading..."
            }, void 0, false, {
                fileName: "[project]/app/app/layout.tsx",
                lineNumber: 110,
                columnNumber: 9
            }, this)
        }, void 0, false, {
            fileName: "[project]/app/app/layout.tsx",
            lineNumber: 109,
            columnNumber: 7
        }, this);
    }
    if (!isAuthenticated) {
        return null;
    }
    const filterItems = (items)=>items.filter((item)=>{
            if (item.hrAdminOnly && user?.role !== "HR_ADMIN") return false;
            return true;
        });
    // DEV MODE: Show ALL navigation including Spaljisten to ALL authenticated users
    // PROD MODE: Would check DB membership for Spaljisten org (not email domain)
    const showSpaljistenNav = isDevMode || isSpaljistenPage;
    const visibleCoreItems = filterItems(coreNavItems);
    const visibleHrItems = filterItems(hrNavItems);
    const visibleMoreItems = moreNavItems;
    const visibleSettingsItems = filterItems(settingsNavItems);
    const visibleSpaljistenItems = showSpaljistenNav ? spaljistenNavItems : [];
    const renderNavItem = (item)=>{
        const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
        const Icon = item.icon;
        return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("li", {
            children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$client$2f$app$2d$dir$2f$link$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["default"], {
                href: item.href,
                className: `flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${isActive ? "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"}`,
                "data-testid": `nav-${item.name.toLowerCase().replace(/\s+/g, "-")}`,
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(Icon, {
                        className: "h-4 w-4"
                    }, void 0, false, {
                        fileName: "[project]/app/app/layout.tsx",
                        lineNumber: 150,
                        columnNumber: 11
                    }, this),
                    item.name
                ]
            }, void 0, true, {
                fileName: "[project]/app/app/layout.tsx",
                lineNumber: 141,
                columnNumber: 9
            }, this)
        }, item.name, false, {
            fileName: "[project]/app/app/layout.tsx",
            lineNumber: 140,
            columnNumber: 7
        }, this);
    };
    return /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$OrgProvider$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["OrgProvider"], {
        children: [
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$GlobalErrorHandler$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["GlobalErrorHandler"], {}, void 0, false, {
                fileName: "[project]/app/app/layout.tsx",
                lineNumber: 159,
                columnNumber: 7
            }, this),
            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                className: "flex flex-col h-screen bg-gray-50 dark:bg-gray-900",
                children: [
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$components$2f$DemoModeBanner$2e$tsx__$5b$app$2d$client$5d$__$28$ecmascript$29$__["DemoModeBanner"], {}, void 0, false, {
                        fileName: "[project]/app/app/layout.tsx",
                        lineNumber: 161,
                        columnNumber: 9
                    }, this),
                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                        className: "flex flex-1 overflow-hidden",
                        children: [
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("aside", {
                                className: "w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                        className: "p-6 border-b border-gray-200 dark:border-gray-700",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("h1", {
                                                className: "text-lg font-semibold text-gray-900 dark:text-white",
                                                children: "Industrial Competence"
                                            }, void 0, false, {
                                                fileName: "[project]/app/app/layout.tsx",
                                                lineNumber: 165,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                className: "text-xs text-gray-500 dark:text-gray-400 mt-1",
                                                children: "Platform"
                                            }, void 0, false, {
                                                fileName: "[project]/app/app/layout.tsx",
                                                lineNumber: 168,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/app/layout.tsx",
                                        lineNumber: 164,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("nav", {
                                        className: "flex-1 p-4 overflow-y-auto",
                                        children: [
                                            visibleCoreItems.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "mb-4",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "px-3 mb-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider",
                                                        children: __TURBOPACK__imported__module__$5b$project$5d2f$lib$2f$copy$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["COPY"].nav.core
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/app/layout.tsx",
                                                        lineNumber: 173,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                                        className: "space-y-1",
                                                        children: visibleCoreItems.map(renderNavItem)
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/app/layout.tsx",
                                                        lineNumber: 176,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/app/layout.tsx",
                                                lineNumber: 172,
                                                columnNumber: 17
                                            }, this),
                                            visibleHrItems.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "mb-4",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "px-3 mb-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider",
                                                        children: "HR Tools"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/app/layout.tsx",
                                                        lineNumber: 184,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                                        className: "space-y-1",
                                                        children: visibleHrItems.map(renderNavItem)
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/app/layout.tsx",
                                                        lineNumber: 187,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/app/layout.tsx",
                                                lineNumber: 183,
                                                columnNumber: 17
                                            }, this),
                                            visibleMoreItems.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "mb-4",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "px-3 mb-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider",
                                                        children: "More"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/app/layout.tsx",
                                                        lineNumber: 195,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                                        className: "space-y-1",
                                                        children: visibleMoreItems.map(renderNavItem)
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/app/layout.tsx",
                                                        lineNumber: 198,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/app/layout.tsx",
                                                lineNumber: 194,
                                                columnNumber: 17
                                            }, this),
                                            visibleSpaljistenItems.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "mb-4",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("p", {
                                                        className: "px-3 mb-2 text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider",
                                                        children: "Spaljisten"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/app/layout.tsx",
                                                        lineNumber: 206,
                                                        columnNumber: 19
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                                        className: "space-y-1",
                                                        children: visibleSpaljistenItems.map(renderNavItem)
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/app/layout.tsx",
                                                        lineNumber: 209,
                                                        columnNumber: 19
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/app/layout.tsx",
                                                lineNumber: 205,
                                                columnNumber: 17
                                            }, this),
                                            visibleSettingsItems.length > 0 && /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "pt-4 border-t border-gray-200 dark:border-gray-700",
                                                children: /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("ul", {
                                                    className: "space-y-1",
                                                    children: visibleSettingsItems.map(renderNavItem)
                                                }, void 0, false, {
                                                    fileName: "[project]/app/app/layout.tsx",
                                                    lineNumber: 217,
                                                    columnNumber: 19
                                                }, this)
                                            }, void 0, false, {
                                                fileName: "[project]/app/app/layout.tsx",
                                                lineNumber: 216,
                                                columnNumber: 17
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/app/layout.tsx",
                                        lineNumber: 170,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/app/layout.tsx",
                                lineNumber: 163,
                                columnNumber: 11
                            }, this),
                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                className: "flex-1 flex flex-col overflow-hidden",
                                children: [
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("header", {
                                        className: "h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6",
                                        children: [
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "text-sm text-gray-500 dark:text-gray-400",
                                                children: new Date().toLocaleDateString("en-US", {
                                                    weekday: "long",
                                                    year: "numeric",
                                                    month: "long",
                                                    day: "numeric"
                                                })
                                            }, void 0, false, {
                                                fileName: "[project]/app/app/layout.tsx",
                                                lineNumber: 227,
                                                columnNumber: 15
                                            }, this),
                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("div", {
                                                className: "flex items-center gap-3",
                                                children: [
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("span", {
                                                        className: "text-sm text-gray-600 dark:text-gray-300",
                                                        "data-testid": "text-user-email",
                                                        children: authUser?.email || user?.email || "User"
                                                    }, void 0, false, {
                                                        fileName: "[project]/app/app/layout.tsx",
                                                        lineNumber: 236,
                                                        columnNumber: 17
                                                    }, this),
                                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("button", {
                                                        onClick: handleSignOut,
                                                        className: "flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors",
                                                        "data-testid": "button-signout",
                                                        children: [
                                                            /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])(__TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$lucide$2d$react$2f$dist$2f$esm$2f$icons$2f$log$2d$out$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__$3c$export__default__as__LogOut$3e$__["LogOut"], {
                                                                className: "h-4 w-4"
                                                            }, void 0, false, {
                                                                fileName: "[project]/app/app/layout.tsx",
                                                                lineNumber: 244,
                                                                columnNumber: 19
                                                            }, this),
                                                            "Sign out"
                                                        ]
                                                    }, void 0, true, {
                                                        fileName: "[project]/app/app/layout.tsx",
                                                        lineNumber: 239,
                                                        columnNumber: 17
                                                    }, this)
                                                ]
                                            }, void 0, true, {
                                                fileName: "[project]/app/app/layout.tsx",
                                                lineNumber: 235,
                                                columnNumber: 15
                                            }, this)
                                        ]
                                    }, void 0, true, {
                                        fileName: "[project]/app/app/layout.tsx",
                                        lineNumber: 226,
                                        columnNumber: 13
                                    }, this),
                                    /*#__PURE__*/ (0, __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$react$2f$jsx$2d$dev$2d$runtime$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["jsxDEV"])("main", {
                                        className: "flex-1 overflow-auto",
                                        children: children
                                    }, void 0, false, {
                                        fileName: "[project]/app/app/layout.tsx",
                                        lineNumber: 250,
                                        columnNumber: 13
                                    }, this)
                                ]
                            }, void 0, true, {
                                fileName: "[project]/app/app/layout.tsx",
                                lineNumber: 225,
                                columnNumber: 11
                            }, this)
                        ]
                    }, void 0, true, {
                        fileName: "[project]/app/app/layout.tsx",
                        lineNumber: 162,
                        columnNumber: 11
                    }, this)
                ]
            }, void 0, true, {
                fileName: "[project]/app/app/layout.tsx",
                lineNumber: 160,
                columnNumber: 7
            }, this)
        ]
    }, void 0, true, {
        fileName: "[project]/app/app/layout.tsx",
        lineNumber: 158,
        columnNumber: 5
    }, this);
}
_s(AppLayout, "hvabVoTWQs5nPH78/8JBsXdSHcY=", false, function() {
    return [
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["usePathname"],
        __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$navigation$2e$js__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useRouter"],
        __TURBOPACK__imported__module__$5b$project$5d2f$hooks$2f$useAuth$2e$ts__$5b$app$2d$client$5d$__$28$ecmascript$29$__["useAuth"]
    ];
});
_c = AppLayout;
var _c;
__turbopack_context__.k.register(_c, "AppLayout");
if (typeof globalThis.$RefreshHelpers$ === 'object' && globalThis.$RefreshHelpers !== null) {
    __turbopack_context__.k.registerExports(__turbopack_context__.m, globalThis.$RefreshHelpers$);
}
}),
]);

//# sourceMappingURL=_c950d66c._.js.map