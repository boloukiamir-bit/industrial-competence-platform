export const COPY = {
  emptyStates: {
    employees: {
      title: "No employees yet",
      description: "Get started by importing employees from a CSV file or adding them manually.",
    },
    organization: {
      title: "No organization units defined",
      description: "Create your first organization unit to structure your company.",
    },
    competenceMatrix: {
      noRequirements: {
        title: "No requirements defined",
        description: "Define position requirements to see skill gaps and risk levels.",
      },
      noEmployees: {
        title: "No employees found",
        description: "Add employees to see the competence matrix.",
      },
    },
    gaps: {
      noRequirements: {
        title: "Cannot calculate gaps",
        description: "Define position requirements first to identify skill gaps.",
      },
      noEmployees: {
        title: "No employees to analyze",
        description: "Add employees before generating gap analysis.",
      },
      noGaps: {
        title: "No skill gaps found",
        description: "All employees meet the position requirements.",
      },
    },
    risks: {
      empty: {
        title: "No events to display",
        description: "The system will automatically create events based on employment data.",
      },
    },
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
    generateGaps: "Generate Gaps",
  },
  setup: {
    title: "Setup Progress",
    description: "Complete these steps to get the most out of your platform.",
    steps: {
      orgUnit: {
        title: "Create at least 1 Organization Unit",
        button: "Create Unit",
      },
      employees: {
        title: "Add employees (at least 1)",
        buttonPrimary: "Import CSV",
        buttonSecondary: "Add Employee",
      },
      skills: {
        title: "Create skills (at least 3)",
        button: "Add Skills",
      },
      positions: {
        title: "Create position with requirements",
        button: "Define Requirements",
      },
      gaps: {
        title: "Generate Tomorrow's Gaps once",
        button: "Generate Gaps",
      },
    },
    complete: "Setup complete",
  },
  nav: {
    core: "Core",
    comingSoon: "Coming Soon",
  },
  sections: {
    overdue: "Overdue",
    dueSoon: "Due Soon",
    upcoming: "Upcoming",
  },
};
