const express = require('express');
const app = express();
app.use(express.json());

let nextId = 4;
const schedules = [
  { id: 1, animalId: 1, employeeId: 1, food: 'Raw meat',    time: '08:00' },
  { id: 2, animalId: 2, employeeId: 1, food: 'Fish flakes', time: '09:00' },
  { id: 3, animalId: 3, employeeId: 2, food: 'Hay & fruit', time: '10:00' },
];

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/', (req, res) => res.json(schedules));

app.get('/:id', (req, res) => {
  const schedule = schedules.find(s => s.id === Number(req.params.id));
  if (!schedule) return res.status(404).json({ message: 'Not found' });
  res.json(schedule);
});

app.post('/', (req, res) => {
  const schedule = { id: nextId++, ...req.body };
  schedules.push(schedule);
  res.status(201).json(schedule);
});

app.put('/:id', (req, res) => {
  const idx = schedules.findIndex(s => s.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ message: 'Not found' });
  schedules[idx] = { ...schedules[idx], ...req.body };
  res.json(schedules[idx]);
});

app.delete('/:id', (req, res) => {
  const idx = schedules.findIndex(s => s.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ message: 'Not found' });
  schedules.splice(idx, 1);
  res.status(204).send();
});

const PORT = process.env.PORT || 4003;
app.listen(PORT, () => console.log(`Schedule service running on port ${PORT}`));
