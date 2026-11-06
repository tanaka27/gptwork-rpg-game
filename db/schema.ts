import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
export const contentVersions=sqliteTable('content_versions',{
 id:text('id').primaryKey(),label:text('label').notNull(),data:text('data').notNull(),status:text('status').notNull(),revision:integer('revision').notNull().default(1),createdAt:text('created_at').notNull(),updatedAt:text('updated_at').notNull()
});
export const appSettings=sqliteTable('app_settings',{key:text('key').primaryKey(),value:text('value').notNull()});
export const saves=sqliteTable('saves',{ownerId:text('owner_id').primaryKey(),state:text('state').notNull(),revision:integer('revision').notNull(),updatedAt:text('updated_at').notNull()});
export const saveHistory=sqliteTable('save_history',{id:text('id').primaryKey(),ownerId:text('owner_id').notNull(),state:text('state').notNull(),revision:integer('revision').notNull(),createdAt:text('created_at').notNull()});
