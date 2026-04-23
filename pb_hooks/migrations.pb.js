// pb_hooks/migrations.pb.js
// Добавляет кастомные поля в встроенную коллекцию users при старте,
// если их ещё нет. Это нужно чтобы хранить username, name, roleId.

onBootstrap((e) => {
  e.next();

  const app = $app;

  try {
    const usersCol = app.findCollectionByNameOrId("users");
    const fields   = usersCol.fields;

    // Проверяем какие поля уже есть
    const existing = fields.getAll().map(f => f.name);

    let changed = false;

    if (!existing.includes("username")) {
      const f = new TextField();
      f.name = "username";
      fields.add(f);
      changed = true;
    }

    if (!existing.includes("name")) {
      const f = new TextField();
      f.name = "name";
      fields.add(f);
      changed = true;
    }

    if (!existing.includes("roleId")) {
      const f = new TextField();
      f.name = "roleId";
      fields.add(f);
      changed = true;
    }

    if (changed) {
      app.save(usersCol);
      console.log("✔ поля username / name / roleId добавлены в users");
    }
  } catch (err) {
    console.error("migrations.pb.js error:", err);
  }
});
