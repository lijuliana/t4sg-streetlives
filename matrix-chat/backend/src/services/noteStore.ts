import { randomUUID } from "node:crypto";
import type { Note } from "../types.js";

interface NoteStoreInterface {
  create(data: Omit<Note, "noteId" | "createdAt">): Note;
  listBySession(sessionId: string): Note[];
}

class InMemoryNoteStore implements NoteStoreInterface {
  private readonly notes = new Map<string, Note[]>();

  create(data: Omit<Note, "noteId" | "createdAt">): Note {
    const note: Note = {
      ...data,
      noteId: randomUUID(),
      createdAt: new Date().toISOString(),
    };
    const list = this.notes.get(data.sessionId) ?? [];
    list.push(note);
    this.notes.set(data.sessionId, list);
    return note;
  }

  listBySession(sessionId: string): Note[] {
    return this.notes.get(sessionId) ?? [];
  }
}

export const noteStore: NoteStoreInterface = new InMemoryNoteStore();
