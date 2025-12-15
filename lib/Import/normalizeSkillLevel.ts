export const normalizeSkillLevel = (raw: string | number): number => {
  if (raw === null || raw === undefined) return 0;

  const v = raw.toString().trim().toLowerCase();

  const map: Record<string, number> = {
    none: 0,
    no: 0,
    "0": 0,

    beginner: 1,
    nybörjare: 1,
    "1": 1,

    "can handle": 2,
    självständig: 2,
    "2": 2,

    skilled: 3,
    erfaren: 3,
    "3": 3,

    expert: 4,
    coach: 4,
    handledare: 4,
    "4": 4,
  };

  return map[v] !== undefined ? map[v] : 0;
};
