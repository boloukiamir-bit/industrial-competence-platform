import { fuzzyMatch } from "@/lib/Import/fuzzyMatch";
import { normalizeSkillLevel } from "@/lib/Import/normalizeSkillLevel";

export async function importCsvData(rows: any[], supabase: any) {
  const { data: existingSkills } = await supabase
    .from("skills")
    .select("id, name");

  const skillNames = existingSkills?.map((s: { id: string; name: string }) => s.name) || [];

  for (const row of rows) {
    const employeeName = row["Name"] || row["Employee"] || row["Namn"];
    if (!employeeName) continue;

    let { data: emp } = await supabase
      .from("employees")
      .select("*")
      .eq("name", employeeName)
      .single();

    if (!emp) {
      const { data: created } = await supabase
        .from("employees")
        .insert([{ name: employeeName }])
        .select()
        .single();
      emp = created;
    }

    for (const key of Object.keys(row)) {
      if (["name", "employee", "namn", "role"].includes(key.toLowerCase()))
        continue;

      const rawSkill = key.trim();
      const normalizedSkill = fuzzyMatch(rawSkill, skillNames);

      let skillId =
        existingSkills?.find((s: { id: string; name: string }) => s.name === normalizedSkill)?.id ?? null;

      if (!skillId) {
        const { data: newSkill } = await supabase
          .from("skills")
          .insert([{ name: rawSkill }])
          .select()
          .single();

        skillId = newSkill.id;
        skillNames.push(rawSkill);
      }

      const rawLevel = row[key];
      const level = normalizeSkillLevel(rawLevel);

      await supabase.from("employee_skills").upsert({
        employee_id: emp.id,
        skill_id: skillId,
        level,
      });
    }
  }
}
