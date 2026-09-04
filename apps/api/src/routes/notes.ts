import { Router } from 'express';
import { createNoteSchema, noteSchema, type Note } from '@sahi/shared';
import { prisma } from '@sahi/db';

export const notesRouter: Router = Router();

function serialize(n: { id: string; text: string; createdAt: Date }): Note {
  return noteSchema.parse({
    id: n.id,
    text: n.text,
    createdAt: n.createdAt.toISOString(),
  });
}

notesRouter.get('/notes', async (_req, res, next) => {
  try {
    const notes = await prisma.note.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });
    res.json(notes.map(serialize));
  } catch (err) {
    next(err);
  }
});

notesRouter.post('/notes', async (req, res, next) => {
  // Same shared schema the client uses to validate before sending.
  const parsed = createNoteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  try {
    const note = await prisma.note.create({ data: { text: parsed.data.text } });
    res.status(201).json(serialize(note));
  } catch (err) {
    next(err);
  }
});
