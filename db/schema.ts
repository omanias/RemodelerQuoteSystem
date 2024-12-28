import { pgTable, text, serial, timestamp, integer, boolean, jsonb, decimal, foreignKey, varchar, unique } from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { relations } from "drizzle-orm";
import { sql } from "drizzle-orm";

// Enums
export const CompanyRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  MULTI_ADMIN: 'MULTI_ADMIN',
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  SALES_REP: 'SALES_REP'
} as const;

export const SubscriptionPlan = {
  FREE: 'FREE',
  BASIC: 'BASIC',
  PRO: 'PRO',
  ENTERPRISE: 'ENTERPRISE'
} as const;

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
  companyId: integer("company_id").references(() => companies.id).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  nameCompanyUnique: unique().on(table.name, table.companyId),
}));

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
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

export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  profileImage: text("profile_image"),
  leadStatus: text("lead_status").notNull().$type<keyof typeof LeadStatus>(),
  leadSource: text("lead_source").notNull().$type<keyof typeof LeadSource>(),
  assignedUserId: integer("assigned_user_id").references(() => users.id),
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
  categoryId: integer("category_id").references(() => categories.id),
  projectTimeline: text("project_timeline"),
  budgetRangeMin: decimal("budget_range_min", { precision: 10, scale: 2 }),
  budgetRangeMax: decimal("budget_range_max", { precision: 10, scale: 2 }),
  projectPriority: text("project_priority"),
  productInterests: text("product_interests").notNull(), 
  financingInterest: boolean("financing_interest").default(false),
  customFields: jsonb("custom_fields"),
  tags: text("tags").notNull(), 
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contactCustomFields = pgTable("contact_custom_fields", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().$type<keyof typeof ContactFieldType>(),
  required: boolean("required").default(false),
  options: text("options"), 
  defaultValue: text("default_value"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contactNotes = pgTable("contact_notes", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").references(() => contacts.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  type: text("type").notNull(), 
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contactTasks = pgTable("contact_tasks", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").references(() => contacts.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: timestamp("due_date"),
  completed: boolean("completed").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contactDocuments = pgTable("contact_documents", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").references(() => contacts.id).notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  url: text("url").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const contactPhotos = pgTable("contact_photos", {
  id: serial("id").primaryKey(),
  contactId: integer("contact_id").references(() => contacts.id).notNull(),
  type: text("type").notNull(), 
  url: text("url").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const subscriptionPlans = pgTable("subscription_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().$type<keyof typeof SubscriptionPlan>(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  billingCycle: text("billing_cycle").notNull(),
  features: jsonb("features").notNull(),
  maxUsers: integer("max_users").notNull(),
  maxStorage: integer("max_storage").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subdomain: text("subdomain").notNull().unique(),
  logo: text("logo"),
  subscriptionPlanId: integer("subscription_plan_id").references(() => subscriptionPlans.id).notNull(),
  timezone: text("timezone").default("UTC").notNull(),
  active: boolean("active").default(true).notNull(),
  brandingSettings: jsonb("branding_settings"),
  customDomain: text("custom_domain").unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const companyUsers = pgTable("company_users", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  role: text("role").notNull().$type<keyof typeof CompanyRole>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  companyUserUnique: unique().on(table.companyId, table.userId),
}));

export const companyAccess = pgTable("company_access", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  companyId: integer("company_id").references(() => companies.id).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  accessUnique: unique().on(table.userId, table.companyId),
}));


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
  contactId: integer("contact_id").references(() => contacts.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  companyUsers: many(companyUsers),
  companyAccess: many(companyAccess),
  quotes: many(quotes),
}));

export const categoriesRelations = relations(categories, ({ many, one }) => ({
  products: many(products),
  quotes: many(quotes),
  templates: many(templates),
  company: one(companies, {
    fields: [categories.companyId],
    references: [companies.id],
  }),
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

export const templatesRelations = relations(templates, ({ one }) => ({
  category: one(categories, {
    fields: [templates.categoryId],
    references: [categories.id],
  }),
}));

export const companiesRelations = relations(companies, ({ one, many }) => ({
  subscriptionPlan: one(subscriptionPlans, {
    fields: [companies.subscriptionPlanId],
    references: [subscriptionPlans.id],
  }),
  companyUsers: many(companyUsers),
  categories: many(categories),
  products: many(products),
  quotes: many(quotes),
}));

export const companyUsersRelations = relations(companyUsers, ({ one }) => ({
  company: one(companies, {
    fields: [companyUsers.companyId],
    references: [companies.id],
  }),
  user: one(users, {
    fields: [companyUsers.userId],
    references: [users.id],
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
  contact: one(contacts, {
    fields: [quotes.contactId],
    references: [contacts.id],
  }),
  company: one(companies, {
    fields: [quotes.categoryId],
    references: [companies.id],
  }),
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
  quotes: many(quotes),
  notes: many(contactNotes),
  tasks: many(contactTasks),
  documents: many(contactDocuments),
  photos: many(contactPhotos),
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
}));

export const contactDocumentsRelations = relations(contactDocuments, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactDocuments.contactId],
    references: [contacts.id],
  }),
}));

export const contactPhotosRelations = relations(contactPhotos, ({ one }) => ({
  contact: one(contacts, {
    fields: [contactPhotos.contactId],
    references: [contacts.id],
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

export const insertContactSchema = createInsertSchema(contacts);
export const selectContactSchema = createSelectSchema(contacts);
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

export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlans);
export const selectSubscriptionPlanSchema = createSelectSchema(subscriptionPlans);
export const insertCompanySchema = createInsertSchema(companies);
export const selectCompanySchema = createSelectSchema(companies);
export const insertCompanyUserSchema = createInsertSchema(companyUsers);
export const selectCompanyUserSchema = createSelectSchema(companyUsers);


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

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
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

export type SubscriptionPlan = typeof subscriptionPlans.$inferSelect;
export type NewSubscriptionPlan = typeof subscriptionPlans.$inferInsert;
export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type CompanyUser = typeof companyUsers.$inferSelect;
export type NewCompanyUser = typeof companyUsers.$inferInsert;