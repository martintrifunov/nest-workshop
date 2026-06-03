const express = require('express');

const app = express();
app.use(express.json());

const exhibits = [
  { id: 1, name: 'African Plains', theme: 'Savanna', capacity: 50, animals: 'giraffes, zebras, wildebeest' },
  { id: 2, name: 'Tropical Rainforest', theme: 'Jungle', capacity: 30, animals: 'jaguars, toucans, anacondas' },
  { id: 3, name: 'Arctic Circle', theme: 'Tundra', capacity: 25, animals: 'polar bears, arctic foxes, seals' },
  { id: 4, name: 'Aquatic World', theme: 'Ocean', capacity: 200, animals: 'sharks, dolphins, octopus' },
];

function toXml(items) {
  const rows = items
    .map(
      (e) =>
        `  <exhibit>\n    <id>${e.id}</id>\n    <name>${e.name}</name>\n    <theme>${e.theme}</theme>\n    <capacity>${e.capacity}</capacity>\n    <animals>${e.animals}</animals>\n  </exhibit>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<exhibits>\n${rows}\n</exhibits>`;
}

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.get('/', (_req, res) => {
  res.type('application/xml').send(toXml(exhibits));
});

app.get('/:id', (req, res) => {
  const exhibit = exhibits.find((e) => e.id === parseInt(req.params.id, 10));
  if (!exhibit) return res.status(404).type('application/xml').send('<error>Not found</error>');
  res.type('application/xml').send(toXml([exhibit]));
});

app.post('/', (req, res) => {
  const exhibit = { id: exhibits.length + 1, ...req.body };
  exhibits.push(exhibit);
  res.status(201).type('application/xml').send(toXml([exhibit]));
});

app.put('/:id', (req, res) => {
  const idx = exhibits.findIndex((e) => e.id === parseInt(req.params.id, 10));
  if (idx === -1) return res.status(404).type('application/xml').send('<error>Not found</error>');
  exhibits[idx] = { ...exhibits[idx], ...req.body };
  res.type('application/xml').send(toXml([exhibits[idx]]));
});

app.delete('/:id', (req, res) => {
  const idx = exhibits.findIndex((e) => e.id === parseInt(req.params.id, 10));
  if (idx === -1) return res.status(404).type('application/xml').send('<error>Not found</error>');
  exhibits.splice(idx, 1);
  res.status(204).send();
});

const PORT = process.env.PORT || 4004;
app.listen(PORT, () => console.log(`Exhibits service listening on port ${PORT}`));
