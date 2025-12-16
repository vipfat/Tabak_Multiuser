# Инструкция по деплою на production (hookahmix.ru)

## Что было сделано:

1. ✅ **База данных настроена**:
   - Таблица `venue_owners` для владельцев заведений
   - Таблица `owner_sessions` для JWT refresh токенов
   - Таблица `venue_applications` для заявок на подключение
   - Добавлены колонки в `venues`: `owner_id`, `address`, `updated_at`

2. ✅ **API обновлен**:
   - Исправлены запросы к БД (используется `title`, не `name`)
   - Все owner endpoints работают: register, login, profile, venues, applications

3. ✅ **Frontend обновлен**:
   - Унифицированные цвета из лендинга в Tailwind (#0B0F1D, #121629, #10B981)
   - Шрифт Plus Jakarta Sans
   - Добавлена кнопка "На главную" в owner cabinet
   - CSS переменные для единого дизайна

## Шаги деплоя:

### 1. Загрузить файлы на сервер

```bash
# Скопировать архив на сервер
scp deploy.tar.gz tabakapp@hookahmix.ru:/home/tabakapp/

# Подключиться к серверу
ssh tabakapp@hookahmix.ru
```

### 2. Распаковать и обновить

```bash
cd /home/tabakapp/apps/tabak_multiuser

# Создать бэкап
tar -czf backup_$(date +%Y%m%d_%H%M%S).tar.gz server/ dist/ 

# Распаковать новые файлы
tar -xzf /home/tabakapp/deploy.tar.gz -C /home/tabakapp/apps/tabak_multiuser/

# Установить зависимости (если нужно)
npm install
```

### 3. Обновить базу данных

```bash
# Подключиться к PostgreSQL
psql -U tabakapp -d appdb

# Выполнить SQL:
CREATE TABLE IF NOT EXISTS venue_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email_verified BOOLEAN DEFAULT false,
  verification_token TEXT,
  reset_token TEXT,
  reset_token_expires TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS owner_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES venue_owners(id) ON DELETE CASCADE,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  user_agent TEXT,
  ip_address VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS venue_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES venue_owners(id) ON DELETE CASCADE,
  venue_name VARCHAR(255) NOT NULL,
  city VARCHAR(255) NOT NULL,
  address TEXT,
  phone VARCHAR(50),
  email VARCHAR(255),
  description TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  admin_notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE venues ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES venue_owners(id) ON DELETE SET NULL;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE venues ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
```

### 4. Перезапустить PM2

```bash
# Остановить старые процессы
pm2 stop all
pm2 delete all

# Запустить API сервер
cd /home/tabakapp/apps/tabak_multiuser
pm2 start server/api.js --name tabak-api

# Проверить статус
pm2 status
pm2 logs tabak-api --lines 50
```

### 5. Проверить nginx

```bash
# Убедиться что nginx правильно настроен
sudo nginx -t

# Перезапустить nginx (если нужно)
sudo systemctl reload nginx
```

## Тестирование

### API endpoints:

```bash
# Получить заведения
curl https://hookahmix.ru/api/venues | jq

# Регистрация владельца
curl -X POST https://hookahmix.ru/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","fullName":"Test Owner","phone":"+79001234567"}'

# Вход
curl -X POST https://hookahmix.ru/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

### Веб-интерфейс:

1. Открыть https://hookahmix.ru/ (лендинг)
2. Перейти на https://hookahmix.ru/owner (личный кабинет)
3. Зарегистрироваться
4. Войти
5. Проверить dashboard
6. Подать заявку на подключение заведения

## Переменные окружения

Файл `.env.local` на production должен содержать:

```env
# Database
DATABASE_URL=postgresql://tabakapp:tabakpass123@localhost:5432/appdb
PGHOST=localhost
PGDATABASE=appdb
PGUSER=tabakapp
PGPASSWORD=tabakpass123

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production
```

**⚠️ ВАЖНО:** Замените секреты JWT на production!

## Структура на сервере

```
/home/tabakapp/apps/
├── tabak_landing/          # Лендинг (React app)
│   └── dist/
├── tabak_multiuser/        # Основное приложение + owner cabinet
│   ├── server/            # API сервер
│   ├── dist/              # Frontend build
│   │   ├── index.html    # Клиентское приложение /app
│   │   └── owner.html    # Owner cabinet /owner
│   └── node_modules/
```

## nginx конфигурация

Проверить что в `/etc/nginx/sites-available/hookahmix.ru` правильные location:

```nginx
location / {
    root /home/tabakapp/apps/tabak_landing/dist;
    try_files $uri $uri/ /index.html;
}

location /app {
    alias /home/tabakapp/apps/tabak_multiuser/dist;
    try_files $uri $uri/ /app/index.html;
}

location /owner {
    alias /home/tabakapp/apps/tabak_multiuser/dist;
    try_files $uri /owner.html;
}

location /api {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
}
```

## Проверка после деплоя

- [ ] API отвечает на запросы
- [ ] Лендинг открывается на /
- [ ] Клиентское приложение работает на /app
- [ ] Owner cabinet открывается на /owner
- [ ] Регистрация владельца работает
- [ ] Вход владельца работает
- [ ] Dashboard отображается корректно
- [ ] Подача заявки работает
- [ ] Единый дизайн на всех страницах

## В случае проблем

```bash
# Посмотреть логи API
pm2 logs tabak-api

# Посмотреть логи nginx
sudo tail -f /var/log/nginx/error.log

# Проверить порты
sudo lsof -i:3000

# Проверить БД
psql -U tabakapp -d appdb -c "\dt"
```
