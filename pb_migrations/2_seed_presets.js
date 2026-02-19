/// <reference path="../pb_data/types.d.ts" />

migrate((app) => {
  const presets = app.findCollectionByNameOrId("presets");

  const data = [
    {
      name: "50/30/20 Rule",
      description: "A simple budgeting method: 50% for needs, 30% for wants, and 20% for savings.",
      categories: [
        { name: "Needs", percentage: 50, color: "#3B82F6" },
        { name: "Wants", percentage: 30, color: "#10B981" },
        { name: "Savings", percentage: 20, color: "#F59E0B" }
      ]
    },
    {
      name: "Zero-Based Budget",
      description: "Allocate every dollar to specific categories until you reach zero.",
      categories: [
        { name: "Housing", percentage: 25, color: "#3B82F6" },
        { name: "Transportation", percentage: 15, color: "#10B981" },
        { name: "Food", percentage: 15, color: "#F59E0B" },
        { name: "Utilities", percentage: 10, color: "#EF4444" },
        { name: "Insurance", percentage: 10, color: "#8B5CF6" },
        { name: "Savings", percentage: 10, color: "#EC4899" },
        { name: "Personal", percentage: 10, color: "#06B6D4" },
        { name: "Entertainment", percentage: 5, color: "#84CC16" }
      ]
    },
    {
      name: "Envelope System",
      description: "A cash-based system with three main spending categories.",
      categories: [
        { name: "Essentials", percentage: 60, color: "#3B82F6" },
        { name: "Financial Goals", percentage: 20, color: "#10B981" },
        { name: "Lifestyle", percentage: 20, color: "#F59E0B" }
      ]
    }
  ];

  for (const preset of data) {
    const record = new Record(presets);
    record.set("name", preset.name);
    record.set("description", preset.description);
    record.set("categories", preset.categories);
    app.save(record);
  }

}, (app) => {
  // Rollback - delete all presets
  const presets = app.findCollectionByNameOrId("presets");
  const records = app.findRecordsByFilter(presets, "1=1");
  for (const record of records) {
    app.delete(record);
  }
});
