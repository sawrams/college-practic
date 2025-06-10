import express from 'express';
import fs from 'fs';
import path from 'path';

const app = express();
app.use(express.json());

const DATA_DIR = path.join(__dirname, 'data');

// Получить все файлы
app.get('/data', (req, res) => {
  fs.readdir(DATA_DIR, (err, files) => {
    if (err) return res.status(500).send('Ошибка чтения данных');
    res.json(files.filter(f => f.endsWith('.json')));
  });
});

// Получить данные из файла
app.get('/data/:filename', (req, res) => {
  const filePath = path.join(DATA_DIR, req.params.filename);
  fs.readFile(filePath, 'utf-8', (err, data) => {
    if (err) return res.status(404).send('Файл не найден');
    res.json(JSON.parse(data));
  });
});

// Создать/обновить файл
app.post('/data/:filename', (req, res) => {
  const filePath = path.join(DATA_DIR, req.params.filename);
  fs.writeFile(filePath, JSON.stringify(req.body, null, 2), err => {
    if (err) return res.status(500).send('Ошибка записи');
    res.send('OK');
  });
});

// Удалить файл
app.delete('/data/:filename', (req, res) => {
  const filePath = path.join(DATA_DIR, req.params.filename);
  fs.unlink(filePath, err => {
    if (err) return res.status(404).send('Файл не найден');
    res.send('Удалено');
  });
});

app.listen(3000, () => {
  console.log('Сервер запущен на http://localhost:3000');
});