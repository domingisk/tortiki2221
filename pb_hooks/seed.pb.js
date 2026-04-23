// pb_hooks/seed.pb.js
// Запускается при каждом старте PocketBase.
// Создаёт роли и пользователя admin если их ещё нет.

onBootstrap((e) => {
  e.next();

  const app = $app;

  // ── 1. Роли ───────────────────────────────────────────────────────────────
  const ALL = ["dashboard","raw","pkg","products","plan","calendar","requests","rbac"];

  const defaultRoles = [
    { id: "role_admin", name: "Администратор",  pages: ALL },
    { id: "role_ceh",   name: "Мастер цеха",
      pages: ["dashboard","raw","pkg","products","plan","calendar","requests"] },
    { id: "role_mag",   name: "Магазин",
      pages: ["dashboard","products","requests","calendar"] },
    { id: "role_opt",   name: "Опт",
      pages: ["dashboard","products","requests","calendar"] },
  ];

  const rolesCol = app.findCollectionByNameOrId("roles");

  for (const rd of defaultRoles) {
    try {
      app.findRecordById("roles", rd.id);
      // уже есть — пропускаем
    } catch (_) {
      const rec = new Record(rolesCol);
      rec.set("id",    rd.id);
      rec.set("name",  rd.name);
      rec.set("pages", rd.pages);
      app.save(rec);
      console.log("✔ роль создана:", rd.name);
    }
  }

  // ── 2. Пользователь admin ────────────────────────────────────────────────
  // Логин: admin   Пароль: 12345
  try {
    app.findAuthRecordByUsername("users", "admin");
    // уже существует — ничего не делаем
  } catch (_) {
    const usersCol = app.findCollectionByNameOrId("users");
    const admin    = new Record(usersCol);
    admin.set("username", "admin");
    admin.set("name",     "Администратор");
    admin.set("email",    "admin@konditer.local");
    admin.set("roleId",   "role_admin");
    admin.setPassword("12345");
    admin.set("verified", true);
    app.save(admin);
    console.log("✔ пользователь admin создан  логин: admin  пароль: 12345");
  }
});
