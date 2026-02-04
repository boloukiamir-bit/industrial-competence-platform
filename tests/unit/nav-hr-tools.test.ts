/**
 * Unit tests for nav HR Tools visibility.
 * Asserts that membership_role "admin" and "hr" can see HR Tools (e.g. Compliance Summary).
 * Matches sidebar filter logic in app/app/layout.tsx and /api/admin/me membership_role semantics.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { isHrAdmin } from "@/lib/auth";

type NavItem = { name: string; hrAdminOnly?: boolean };

const hrNavItems: NavItem[] = [
  { name: "Compliance Summary", hrAdminOnly: true },
  { name: "Action Inbox", hrAdminOnly: true },
  { name: "HR Workflows", hrAdminOnly: true },
];

function filterItems(items: NavItem[], role: string | null): NavItem[] {
  const roleNormalized = (role ?? "").toLowerCase();
  return items.filter((item) => {
    if (item.hrAdminOnly && !isHrAdmin(roleNormalized)) return false;
    return true;
  });
}

test("isHrAdmin returns true for admin", () => {
  assert.equal(isHrAdmin("admin"), true);
});

test("isHrAdmin returns true for hr", () => {
  assert.equal(isHrAdmin("hr"), true);
});

test("isHrAdmin returns false for user", () => {
  assert.equal(isHrAdmin("user"), false);
});

test("isHrAdmin returns false for manager", () => {
  assert.equal(isHrAdmin("manager"), false);
});

test("filtered hrNavItems with role admin includes Compliance Summary", () => {
  const visible = filterItems(hrNavItems, "admin");
  const names = visible.map((i) => i.name);
  assert.ok(
    names.includes("Compliance Summary"),
    `Expected Compliance Summary in [${names.join(", ")}]`
  );
});

test("filtered hrNavItems with role hr includes Compliance Summary", () => {
  const visible = filterItems(hrNavItems, "hr");
  const names = visible.map((i) => i.name);
  assert.ok(
    names.includes("Compliance Summary"),
    `Expected Compliance Summary in [${names.join(", ")}]`
  );
});

test("filtered hrNavItems with role user excludes Compliance Summary", () => {
  const visible = filterItems(hrNavItems, "user");
  const names = visible.map((i) => i.name);
  assert.ok(
    !names.includes("Compliance Summary"),
    `Expected Compliance Summary not in [${names.join(", ")}]`
  );
});

test("reactivity: role change from empty to admin causes HR Tools items to appear", () => {
  const whenEmpty = filterItems(hrNavItems, "");
  const whenAdmin = filterItems(hrNavItems, "admin");
  assert.equal(whenEmpty.length, 0, "Empty role yields no hrAdminOnly items");
  assert.ok(
    whenAdmin.some((i) => i.name === "Compliance Summary"),
    "Admin role yields Compliance Summary"
  );
});
