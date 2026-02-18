/* global process, console */
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = fs.readFileSync(".env.local", "utf8");
const get = (k) => (env.match(new RegExp(`^${k}="?([^"\\n]+)"?$`, "m")) || [])[1];

const url = get("NEXT_PUBLIC_SUPABASE_URL");
const anon = get("NEXT_PUBLIC_SUPABASE_ANON_KEY");
if (!url || !anon) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local");

const email = process.env.TEST_EMAIL;
const password = process.env.TEST_PASSWORD;
if (!email || !password) throw new Error("Set TEST_EMAIL and TEST_PASSWORD env vars");

const supabase = createClient(url, anon);

const { error: authErr } = await supabase.auth.signInWithPassword({ email, password });
if (authErr) throw authErr;

const { data, error } = await supabase.from("skills").select("id", { count: "exact", head: true });
if (error) throw error;

console.log("RLS count (skills):", data?.length ?? 0, "(head:true so length is 0), count:", supabase? "see below" : "");
// Supabase returns count on the response object, not in data. Re-run without head to print count safely:
const r = await supabase.from("skills").select("id", { count: "exact" }).limit(1000);
if (r.error) throw r.error;
console.log("RLS count (skills):", r.count);
