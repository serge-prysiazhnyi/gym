import { pgTable, uuid, varchar, timestamp, pgEnum } from 'drizzle-orm/pg-core';

export const userRole = pgEnum('user_role', ['user', 'admin']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  role: userRole('role').notNull().default('user'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  name: varchar('name'),
  // name
});

export const muscleGroups = pgTable('muscle_groups', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 64 }).notNull().unique(),
});

export const exercises = pgTable('exercises', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: varchar('name', { length: 255 }).notNull().unique(),
});

// --- join table: one exercise works many muscles ---

// --- workouts (one session) ---

// --- workout sets (the big table) ---

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
