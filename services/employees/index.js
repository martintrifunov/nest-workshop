const express = require('express');
const app = express();
app.use(express.json());

let nextId = 4;
const employees = [
  { id: 1, name: 'Alice',  surname: 'Walker',  jobTitle: 'Zookeeper',  pay: 45000 },
  { id: 2, name: 'Bob',    surname: 'Smith',   jobTitle: 'Vet',        pay: 72000 },
  { id: 3, name: 'Carol',  surname: 'Jones',   jobTitle: 'Manager',    pay: 68000 },
];

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/', (req, res) => res.json(employees));

app.get('/:id', (req, res) => {
  const employee = employees.find(e => e.id === Number(req.params.id));
  if (!employee) return res.status(404).json({ message: 'Not found' });
  res.json(employee);
});

app.post('/', (req, res) => {
  const employee = { id: nextId++, ...req.body };
  employees.push(employee);
  res.status(201).json(employee);
});

app.put('/:id', (req, res) => {
  const idx = employees.findIndex(e => e.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ message: 'Not found' });
  employees[idx] = { ...employees[idx], ...req.body };
  res.json(employees[idx]);
});

app.delete('/:id', (req, res) => {
  const idx = employees.findIndex(e => e.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ message: 'Not found' });
  employees.splice(idx, 1);
  res.status(204).send();
});

const PORT = process.env.PORT || 4002;
app.listen(PORT, () => console.log(`Employees service running on port ${PORT}`));
