# Восстановление к версии v1.1.0

## Текущая стабильная версия: v1.1.0

Эта версия включает:
- ✅ Супер-админ панель для управления заявками
- ✅ Role-based access control (RBAC)
- ✅ Одобрение/отклонение заявок на заведения
- ✅ Переключение видимости заведений
- ✅ Кнопка "Супер-админ" в шапке кабинета
- ✅ Автоматическое открытие панели для super_admin
- ✅ Все типы данных исправлены (integer IDs)

## Как вернуться к этой версии

### 1. Вернуть код к версии v1.1.0

```bash
cd /workspaces/Tabak_Multiuser
git fetch --all --tags
git checkout v1.1.0
```

### 2. Пересобрать проект

```bash
npm run build
```

### 3. Задеплоить на сервер

```bash
# Загрузить frontend (dist/)
scp -r dist/* root@103.88.241.78:/home/tabakapp/apps/tabak_multiuser/dist/

# Загрузить backend (server/)
scp -r server/* root@103.88.241.78:/home/tabakapp/apps/tabak_multiuser/server/

# Перезапустить API
ssh root@103.88.241.78 "pm2 restart tabak-api"
```

### 4. Проверить работу

- Откройте https://hookahmix.ru/owner
- Войдите как pl79vi86@gmail.com
- Супер-админ панель должна открыться автоматически
- Проверьте approve/reject заявок

## Быстрое восстановление (одной командой)

```bash
cd /workspaces/Tabak_Multiuser && \
git checkout v1.1.0 && \
npm run build && \
scp -r dist/* root@103.88.241.78:/home/tabakapp/apps/tabak_multiuser/dist/ && \
scp -r server/* root@103.88.241.78:/home/tabakapp/apps/tabak_multiuser/server/ && \
ssh root@103.88.241.78 "pm2 restart tabak-api"
```

## Состояние базы данных на момент v1.1.0

### Super admin пользователь:
- Email: pl79vi86@gmail.com
- Role: super_admin
- ID: 5

### Таблицы:
- `venue_owners` - содержит роль (owner/super_admin)
- `venue_applications` - заявки на подключение заведений (id: integer)
- `venues` - активные заведения (id: integer, owner_id: integer)

## Защищенные endpoints:

```javascript
// Только для super_admin:
GET  /api/owner/applications/all      // Все заявки
POST /api/owner/applications/:id/approve  // Одобрить заявку
POST /api/owner/applications/:id/reject   // Отклонить заявку
PATCH /api/owner/venues/:id/visibility    // Изменить видимость

// Для всех владельцев:
GET  /api/owner/venues                // Свои заведения
POST /api/owner/applications          // Создать заявку
GET  /api/owner/applications          // Свои заявки
```

## Примечания

- PM2 процесс: `tabak-api` (порт 3000)
- Nginx конфигурация: `/etc/nginx/sites-available/tabak`
- Логи API: `/root/.pm2/logs/tabak-api-error.log`
- База данных: PostgreSQL, `appdb`, пользователь `tabakapp`

## Контакты

При проблемах проверьте:
1. PM2 статус: `ssh root@103.88.241.78 "pm2 list"`
2. API логи: `ssh root@103.88.241.78 "cat /root/.pm2/logs/tabak-api-error.log | tail -50"`
3. Nginx статус: `ssh root@103.88.241.78 "systemctl status nginx"`
