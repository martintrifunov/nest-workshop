const express = require('express');
const app = express();
app.use(express.json());

let nextId = 4;
const animals = [
  { id: 1, name: 'Simba',  species: 'Lion',      age: 5  },
  { id: 2, name: 'Nemo',   species: 'Clownfish',  age: 2  },
  { id: 3, name: 'Dumbo',  species: 'Elephant',   age: 10 },
  { id: 4, name: 'Jojo',  species: 'Budgie',   age: 10 },
];

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.get('/', (req, res) => res.json(animals));

app.get('/:id', (req, res) => {
  const animal = animals.find(a => a.id === Number(req.params.id));
  if (!animal) return res.status(404).json({ message: 'Not found' });
  res.json(animal);
});

app.post('/', (req, res) => {
  const animal = { id: nextId++, ...req.body };
  animals.push(animal);
  res.status(201).json(animal);
});

app.put('/:id', (req, res) => {
  const idx = animals.findIndex(a => a.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ message: 'Not found' });
  animals[idx] = { ...animals[idx], ...req.body };
  res.json(animals[idx]);
});

app.delete('/:id', (req, res) => {
  const idx = animals.findIndex(a => a.id === Number(req.params.id));
  if (idx === -1) return res.status(404).json({ message: 'Not found' });
  animals.splice(idx, 1);
  res.status(204).send();
});

const PORT = process.env.PORT || 4001;
app.listen(PORT, () => console.log(`Animals service running on port ${PORT}`));
