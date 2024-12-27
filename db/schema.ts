import { pgTable, text, serial, timestamp, integer, boolean, jsonb, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";

// Enums
export const UserRole = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  SALES_REP: 'SALES_REP'
} as const;

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE'
} as const;

export const QuoteStatus = {
  DRAFT: 'DRAFT',
  SENT: 'SENT',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  REVISED: 'REVISED'
} as const;

export const PaymentMethod = {
  CASH: 'Cash',
  CREDIT_CARD: 'Credit Card',
  BANK_TRANSFER: 'Bank Transfer',
  PAYMENT_PLAN: 'Payment Plan'
} as const;

export const ProductUnit = {
  SQUARE_FOOT: 'Square Foot',
  LINEAR_FOOT: 'Linear Foot',
  UNIT: 'Unit',
  HOURS: 'Hours',
  DAYS: 'Days',
  PIECE: 'Piece'
} as const;

export const PermissionType = {
  VIEW: 'VIEW',
  CREATE: 'CREATE',
  EDIT: 'EDIT',
  DELETE: 'DELETE'
} as const;

// Tables
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull().$type<keyof typeof UserRole>(),
  status: text("status").notNull().$type<keyof typeof UserStatus>(),
  password: text("password").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  categoryId: integer("category_id").references(() => categories.id).notNull(),
  basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(),
  cost: decimal("cost", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").notNull().$type<keyof typeof ProductUnit>(),
  isActive: boolean("is_active").default(true).notNull(),
  variations: jsonb("variations"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const templates = pgTable("templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  categoryId: integer("category_id").references(() => categories.id).notNull(),
  termsAndConditions: text("terms_and_conditions"),
  imageUrls: jsonb("image_urls"),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Table for storing table-specific permissions
export const tablePermissions = pgTable("table_permissions", {
  id: serial("id").primaryKey(),
  tableName: text("table_name").notNull(),
  roleId: text("role").notNull().$type<keyof typeof UserRole>(),
  permissionType: text("permission_type").notNull().$type<keyof typeof PermissionType>(),
  isAllowed: boolean("is_allowed").default(false).notNull(),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const quotes = pgTable("quotes", {
  id: serial("id").primaryKey(),
  number: text("number").notNull().unique(),
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email").notNull(),
  clientPhone: text("client_phone"),
  clientAddress: text("client_address"),
  status: text("status").notNull().$type<keyof typeof QuoteStatus>(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  discountType: text("discount_type"),
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }),
  discountCode: text("discount_code"),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }),
  taxAmount: decimal("tax_amount", { precision: 10, scale: 2 }),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  paymentMethod: text("payment_method").$type<keyof typeof PaymentMethod>(),
  downPaymentType: text("down_payment_type"),
  downPaymentValue: decimal("down_payment_value", { precision: 10, scale: 2 }),
  remainingBalance: decimal("remaining_balance", { precision: 10, scale: 2 }),
  content: jsonb("content").notNull(),
  notes: text("notes"),
  userId: integer("user_id").references(() => users.id).notNull(),
  templateId: integer("template_id").references(() => templates.id).notNull(),
  categoryId: integer("category_id").references(() => categories.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  quotes: many(quotes),
  createdPermissions: many(tablePermissions, { relationName: "createdPermissions" }),
}));

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
  quotes: many(quotes),
  templates: many(templates),
}));

export const productsRelations = relations(products, ({ one }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
}));

export const quotesRelations = relations(quotes, ({ one }) => ({
  user: one(users, {
    fields: [quotes.userId],
    references: [users.id],
  }),
  template: one(templates, {
    fields: [quotes.templateId],
    references: [templates.id],
  }),
  category: one(categories, {
    fields: [quotes.categoryId],
    references: [categories.id],
  }),
}));

export const templatesRelations = relations(templates, ({ one }) => ({
  category: one(categories, {
    fields: [templates.categoryId],
    references: [categories.id],
  }),
}));

// Schemas
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export const insertProductSchema = createInsertSchema(products);
export const selectProductSchema = createSelectSchema(products);
export const insertTemplateSchema = createInsertSchema(templates);
export const selectTemplateSchema = createSelectSchema(templates);
export const insertQuoteSchema = createInsertSchema(quotes);
export const selectQuoteSchema = createSelectSchema(quotes);
export const insertCategorySchema = createInsertSchema(categories);
export const selectCategorySchema = createSelectSchema(categories);
export const insertTablePermissionSchema = createInsertSchema(tablePermissions);
export const selectTablePermissionSchema = createSelectSchema(tablePermissions);

// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Template = typeof templates.$inferSelect;
export type NewTemplate = typeof templates.$inferInsert;
export type Quote = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type TablePermission = typeof tablePermissions.$inferSelect;
export type NewTablePermission = typeof tablePermissions.$inferInsert;