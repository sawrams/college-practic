import express from 'express';
import fs from 'fs';
import path from 'path';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const app = express();
app.use(express.json());

// Директория для хранения данных пользователей
const DATA_DIR = path.join(__dirname, 'data');
// Файл для хранения информации о пользователях
const USERS_FILE = path.join(DATA_DIR, 'users.json');
// Секрет для подписи JWT токенов
const JWT_SECRET = 'KS54_SECRET_PRACTICS';

// Создать директорию данных, если не существует
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// Типы для пользователя и коллекции пользователей
type User = { id: string; username: string; password: string };
type Users = Record<string, User>;

// Функция для чтения пользователей из файла
function readUsers(): Users {
  if (!fs.existsSync(USERS_FILE)) return {};
  const data = fs.readFileSync(USERS_FILE, 'utf-8');
  return JSON.parse(data);
}

// Функция для записи пользователей в файл
function writeUsers(users: Users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// Мидлвар для проверки JWT токена
function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send('No token');
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { username: string; id: string };
    req.user = payload;
    next();
  } catch {
    res.status(401).send('Invalid token');
  }
}

// Регистрация нового пользователя
app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send('Missing credentials');

  const users = readUsers();
  // Проверка, существует ли пользователь с таким именем
  if (Object.values(users).some(u => u.username === username)) return res.status(409).send('User exists');

  // Генерация уникального ID для пользователя
  const id = crypto.randomUUID();
  // Хеширование пароля
  const hash = await bcrypt.hash(password, 10);
  users[id] = { id, username, password: hash };
  writeUsers(users);

  // Создать папку пользователя для хранения его файлов
  const userDir = path.join(DATA_DIR, id);
  if (!fs.existsSync(userDir)) fs.mkdirSync(userDir);

  res.send('Registered');
});

// Вход пользователя и выдача JWT
app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).send('Missing credentials');

  const users = readUsers();
  // Поиск пользователя по имени
  const user = Object.values(users).find(u => u.username === username);
  if (!user) return res.status(401).send('Invalid credentials');

  // Проверка пароля
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).send('Invalid credentials');

  // Генерация JWT токена
  const token = jwt.sign({ username: user.username, id: user.id }, JWT_SECRET, { expiresIn: '1h' });
  res.json({ token });
});

// Все маршруты ниже требуют авторизации
app.use('/data', authMiddleware);

// Получить список всех файлов пользователя
app.get('/data', (req, res) => {
  const userDir = path.join(DATA_DIR, req.user.id);
  fs.readdir(userDir, (err, files) => {
    if (err) return res.status(500).send('Ошибка чтения данных');
    // Фильтруем только .json файлы
    const dataFiles = files.filter(f => f.endsWith('.json'));
    res.json(dataFiles);
  });
});

// Получить содержимое конкретного файла пользователя
app.get('/data/:filename', (req, res) => {
  const userDir = path.join(DATA_DIR, req.user.id);
  const filePath = path.join(userDir, req.params.filename);
  fs.readFile(filePath, 'utf-8', (err, data) => {
    if (err) return res.status(404).send('Файл не найден');
    res.json(JSON.parse(data));
  });
});

// Создать или обновить файл пользователя
app.post('/data/:filename', (req, res) => {
  const userDir = path.join(DATA_DIR, req.user.id);
  // Создать папку пользователя, если не существует
  if (!fs.existsSync(userDir)) fs.mkdirSync(userDir);
  const filePath = path.join(userDir, req.params.filename);
  fs.writeFile(filePath, JSON.stringify(req.body, null, 2), err => {
    if (err) return res.status(500).send('Ошибка записи');
    res.send('OK');
  });
});

// Удалить файл пользователя
app.delete('/data/:filename', (req, res) => {
  const userDir = path.join(DATA_DIR, req.user.id);
  const filePath = path.join(userDir, req.params.filename);
  fs.unlink(filePath, err => {
    if (err) return res.status(404).send('Файл не найден');
    res.send('Удалено');
  });
});

// Запуск сервера на порту 3000
app.listen(3000, () => {
  console.log('Сервер запущен на http://localhost:3000');
});