import { pgTable, text, serial, timestamp, integer, boolean, jsonb, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations, type SQL, sql, type Many } from "drizzle-orm";

// Enums
export const UserRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  MULTI_ADMIN: 'MULTI_ADMIN',
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

export const LeadStatus = {
  NEW: 'NEW',
  CONTACTED: 'CONTACTED',
  QUOTE_SENT: 'QUOTE_SENT',
  PROJECT_STARTED: 'PROJECT_STARTED',
  COMPLETED: 'COMPLETED',
  LOST: 'LOST'
} as const;

export const LeadSource = {
  WEBSITE: 'WEBSITE',
  REFERRAL: 'REFERRAL',
  SOCIAL_MEDIA: 'SOCIAL_MEDIA',
  HOME_SHOW: 'HOME_SHOW',
  ADVERTISEMENT: 'ADVERTISEMENT',
  OTHER: 'OTHER'
} as const;

export const PropertyType = {
  SINGLE_FAMILY: 'SINGLE_FAMILY',
  MULTI_FAMILY: 'MULTI_FAMILY',
  COMMERCIAL: 'COMMERCIAL'
} as const;

export const ContactFieldType = {
  TEXT: 'TEXT',
  NUMBER: 'NUMBER',
  DATE: 'DATE',
  DROPDOWN: 'DROPDOWN',
  MULTI_SELECT: 'MULTI_SELECT',
  CHECKBOX: 'CHECKBOX',
  CURRENCY: 'CURRENCY',
  FILE: 'FILE'
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
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subdomain: text("subdomain").notNull().unique(),
  settings: jsonb("settings"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  role: text("role").notNull().$type<keyof typeof UserRole>(),
  status: text("status").notNull().$type<keyof typeof UserStatus>(),
  password: text("password").notNull(),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  categoryId: integer("category_id")
    .references(() => categories.id, { onDelete: 'cascade' })
    .notNull(),
  basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(),
  cost: decimal("cost", { precision: 10, scale: 2 }).notNull(),
  unit: text("unit").notNull().$type<keyof typeof ProductUnit>(),
  isActive: boolean("is_active").default(true).notNull(),
  variations: jsonb("variations"),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const templates = pgTable("templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  categoryId: integer("category_id")
    .references(() => categories.id, { onDelete: 'cascade' })
    .notNull(),
  termsAndConditions: text("terms_and_conditions"),
  imageUrls: jsonb("image_urls"),
  isDefault: boolean("is_default").default(false).notNull(),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  profileImage: text("profile_image"),
  leadStatus: text("lead_status").notNull().$type<keyof typeof LeadStatus>(),
  leadSource: text("lead_source").notNull().$type<keyof typeof LeadSource>(),
  assignedUserId: integer("assigned_user_id")
    .references(() => users.id)
    .notNull(),
  propertyType: text("property_type").notNull().$type<keyof typeof PropertyType>(),
  primaryEmail: text("primary_email").notNull(),
  secondaryEmail: text("secondary_email"),
  primaryPhone: text("primary_phone").notNull(),
  mobilePhone: text("mobile_phone"),
  preferredContact: text("preferred_contact"),
  bestTimeToContact: text("best_time_to_contact"),
  communicationPreferences: jsonb("communication_preferences"),
  primaryAddress: text("primary_address").notNull(),
  projectAddress: text("project_address"),
  propertyAge: integer("property_age"),
  propertyStyle: text("property_style"),
  squareFootage: integer("square_footage"),
  numberOfStories: integer("number_of_stories"),
  previousRenovations: jsonb("previous_renovations"),
  propertyNotes: text("property_notes"),
  categoryId: integer("category_id")
    .references(() => categories.id),
  projectTimeline: text("project_timeline"),
  budgetRangeMin: decimal("budget_range_min", { precision: 10, scale: 2 }),
  budgetRangeMax: decimal("budget_range_max", { precision: 10, scale: 2 }),
  projectPriority: text("project_priority"),
  productInterests: text("product_interests").notNull(),
  financingInterest: boolean("financing_interest").default(false),
  customFields: jsonb("custom_fields"),
  tags: text("tags").array(),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const quotes = pgTable("quotes", {
  id: serial("id").primaryKey(),
  number: text("number").notNull(),
  categoryId: integer("category_id")
    .references(() => categories.id)
    .notNull(),
  templateId: integer("template_id")
    .references(() => templates.id)
    .notNull(),
  contactId: integer("contact_id")
    .references(() => contacts.id),
  clientName: text("client_name").notNull(),
  clientEmail: text("client_email"),
  clientPhone: text("client_phone"),
  clientAddress: text("client_address"),
  status: text("status").notNull().$type<keyof typeof QuoteStatus>(),
  content: jsonb("content").notNull(),
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).notNull(),
  total: decimal("total", { precision: 10, scale: 2 }).notNull(),
  downPaymentValue: decimal("down_payment_value", { precision: 10, scale: 2 }),
  downPaymentType: text("down_payment_type"),
  discountType: text("discount_type"),
  discountValue: decimal("discount_value", { precision: 10, scale: 2 }),
  taxRate: decimal("tax_rate", { precision: 10, scale: 2 }),
  remainingBalance: decimal("remaining_balance", { precision: 10, scale: 2 }),
  notes: text("notes"),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const tablePermissions = pgTable("table_permissions", {
  id: serial("id").primaryKey(),
  tableName: text("table_name").notNull(),
  roleId: text("role").notNull().$type<keyof typeof UserRole>(),
  permissionType: text("permission_type").notNull().$type<keyof typeof PermissionType>(),
  isAllowed: boolean("is_allowed").default(false).notNull(),
  createdBy: integer("created_by").references(() => users.id),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contactCustomFields = pgTable("contact_custom_fields", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().$type<keyof typeof ContactFieldType>(),
  required: boolean("required").default(false),
  options: text("options").array(),
  defaultValue: text("default_value"),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contactNotes = pgTable("contact_notes", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id")
    .references(() => contacts.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  content: text("content").notNull(),
  type: text("type").notNull(),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contactTasks = pgTable("contact_tasks", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id")
    .references(() => contacts.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: timestamp("due_date"),
  completed: boolean("completed").default(false),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contactDocuments = pgTable("contact_documents", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id")
    .references(() => contacts.id, { onDelete: 'cascade' })
    .notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  url: text("url").notNull(),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contactPhotos = pgTable("contact_photos", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id")
    .references(() => contacts.id, { onDelete: 'cascade' })
    .notNull(),
  type: text("type").notNull(),
  url: text("url").notNull(),
  description: text("description"),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Add notes table after contactPhotos and before companyAccess
export const notes = pgTable("notes", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  contactId: integer("contact_id")
    .references(() => contacts.id, { onDelete: 'cascade' })
    .notNull(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  type: text("type").notNull(),
  quoteId: integer("quote_id")
    .references(() => quotes.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const companyAccess = pgTable("company_access", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .references(() => users.id)
    .notNull(),
  companyId: integer("company_id")
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const companiesRelations = relations(companies, ({ many }) => ({
  users: many(users),
  categories: many(categories),
  products: many(products),
  templates: many(templates),
  contacts: many(contacts),
  quotes: many(quotes),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  company: one(companies, {
    fields: [users.companyId],
    references: [companies.id],
  }),
  assignedContacts: many(contacts, { relationName: "assignedUser" }),
  companyAccess: many(companyAccess)
}));

export const categoriesRelations = relations(categories, ({ one, many }) => ({
  company: one(companies, {
    fields: [categories.companyId],
    references: [companies.id],
  }),
  products: many(products),
  templates: many(templates),
  quotes: many(quotes),
}));

export const productsRelations = relations(products, ({ one }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  company: one(companies, {
    fields: [products.companyId],
    references: [companies.id],
  }),
}));

export const templatesRelations = relations(templates, ({ one, many }) => ({
  category: one(categories, {
    fields: [templates.categoryId],
    references: [categories.id],
  }),
  company: one(companies, {
    fields: [templates.companyId],
    references: [companies.id],
  }),
  quotes: many(quotes),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  assignedUser: one(users, {
    fields: [contacts.assignedUserId],
    references: [users.id],
  }),
  category: one(categories, {
    fields: [contacts.categoryId],
    references: [categories.id],
  }),
  company: one(companies, {
    fields: [contacts.companyId],
    references: [companies.id],
  }),
  quotes: many(quotes),
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
  contact: one(contacts, {
    fields: [quotes.contactId],
    references: [contacts.id],
  }),
  company: one(companies, {
    fields: [quotes.companyId],
    references: [companies.id],
  }),
}));

export const contactNotesRelations = relations(contactNotes, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactNotes.contactId],
    references: [contacts.id],
  }),
  user: one(users, {
    fields: [contactNotes.userId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [contactNotes.companyId],
    references: [companies.id],
  }),
}));

export const contactTasksRelations = relations(contactTasks, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactTasks.contactId],
    references: [contacts.id],
  }),
  user: one(users, {
    fields: [contactTasks.userId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [contactTasks.companyId],
    references: [companies.id],
  }),
}));

export const contactDocumentsRelations = relations(contactDocuments, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactDocuments.contactId],
    references: [contacts.id],
  }),
  company: one(companies, {
    fields: [contactDocuments.companyId],
    references: [companies.id],
  }),
}));

export const contactPhotosRelations = relations(contactPhotos, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactPhotos.contactId],
    references: [contacts.id],
  }),
  company: one(companies, {
    fields: [contactPhotos.companyId],
    references: [companies.id],
  }),
}));

// Add notes relations after contactPhotosRelations
export const notesRelations = relations(notes, ({ one }) => ({
  contact: one(contacts, {
    fields: [notes.contactId],
    references: [contacts.id],
  }),
  user: one(users, {
    fields: [notes.userId],
    references: [users.id],
  }),
  quote: one(quotes, {
    fields: [notes.quoteId],
    references: [quotes.id],
  }),
}));

export const tablePermissionsRelations = relations(tablePermissions, ({ one }) => ({
  company: one(companies, {
    fields: [tablePermissions.companyId],
    references: [companies.id],
  }),
  user: one(users, {
    fields: [tablePermissions.createdBy],
    references: [users.id],
  }),
}));

export const companyAccessRelations = relations(companyAccess, ({ one }) => ({
  user: one(users, {
    fields: [companyAccess.userId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [companyAccess.companyId],
    references: [companies.id],
  }),
}));


// Types
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Product = typeof products.$inferSelect;
export type NewProduct = typeof products.$inferInsert;
export type Template = typeof templates.$inferSelect;
export type NewTemplate = typeof templates.$inferInsert;
export type Category = typeof categories.$inferSelect;
export type NewCategory = typeof categories.$inferInsert;
export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type Quote = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;
export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type ContactNote = typeof contactNotes.$inferSelect;
export type NewContactNote = typeof contactNotes.$inferInsert;
export type ContactTask = typeof contactTasks.$inferSelect;
export type NewContactTask = typeof contactTasks.$inferInsert;
export type ContactDocument = typeof contactDocuments.$inferSelect;
export type NewContactDocument = typeof contactDocuments.$inferInsert;
export type ContactPhoto = typeof contactPhotos.$inferSelect;
export type NewContactPhoto = typeof contactPhotos.$inferInsert;
export type ContactCustomField = typeof contactCustomFields.$inferSelect;
export type NewContactCustomField = typeof contactCustomFields.$inferInsert;
export type TablePermission = typeof tablePermissions.$inferSelect;
export type NewTablePermission = typeof tablePermissions.$inferInsert;
export type CompanyAccess = typeof companyAccess.$inferSelect;
export type NewCompanyAccess = typeof companyAccess.$inferInsert;

// Add Note types at the end of the types section
export type Note = typeof notes.$inferSelect;
export type NewNote = typeof notes.$inferInsert;

// Zod schemas
export const insertUserSchema = createInsertSchema(users);
export const selectUserSchema = createSelectSchema(users);
export const insertProductSchema = createInsertSchema(products);
export const selectProductSchema = createSelectSchema(products);
export const insertTemplateSchema = createInsertSchema(templates);
export const selectTemplateSchema = createSelectSchema(templates);
export const insertCategorySchema = createInsertSchema(categories);
export const selectCategorySchema = createSelectSchema(categories);
export const insertContactSchema = createInsertSchema(contacts);
export const selectContactSchema = createSelectSchema(contacts);
export const insertQuoteSchema = createInsertSchema(quotes);
export const selectQuoteSchema = createSelectSchema(quotes);
export const insertCompanySchema = createInsertSchema(companies);
export const selectCompanySchema = createSelectSchema(companies);
export const insertTablePermissionSchema = createInsertSchema(tablePermissions);
export const selectTablePermissionSchema = createSelectSchema(tablePermissions);
export const insertContactNoteSchema = createInsertSchema(contactNotes);
export const selectContactNoteSchema = createSelectSchema(contactNotes);
export const insertContactTaskSchema = createInsertSchema(contactTasks);
export const selectContactTaskSchema = createSelectSchema(contactTasks);
export const insertContactDocumentSchema = createInsertSchema(contactDocuments);
export const selectContactDocumentSchema = createSelectSchema(contactDocuments);
export const insertContactPhotoSchema = createInsertSchema(contactPhotos);
export const selectContactPhotoSchema = createSelectSchema(contactPhotos);
export const insertContactCustomFieldSchema = createInsertSchema(contactCustomFields);
export const selectContactCustomFieldSchema = createSelectSchema(contactCustomFields);
export const insertCompanyAccessSchema = createInsertSchema(companyAccess);
export const selectCompanyAccessSchema = createSelectSchema(companyAccess);

// Add Note schemas at the end of the schemas section
export const insertNoteSchema = createInsertSchema(notes);
export const selectNoteSchema = createSelectSchema(notes);