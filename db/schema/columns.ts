import { text, timestamp } from "drizzle-orm/pg-core";

export const id = () =>
  text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());
export const createdAt = () => timestamp().notNull().defaultNow();
export const updatedAt = () =>
  timestamp()
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
