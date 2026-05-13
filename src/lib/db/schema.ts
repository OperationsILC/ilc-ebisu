import {
	pgTable,
	uuid,
	text,
	boolean,
	integer,
	bigint,
	numeric,
	timestamp,
	jsonb,
	unique,
	index
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ---------------------------------------------------------------------------
// Auth.js standard tables — managed by @auth/drizzle-adapter
// ---------------------------------------------------------------------------

export const users = pgTable('users', {
	id: uuid('id').defaultRandom().primaryKey(),
	email: text('email').notNull().unique(),
	emailVerified: timestamp('emailVerified', { withTimezone: true, mode: 'date' }),
	name: text('name'),
	image: text('image'),
	// Application-specific:
	role: text('role').notNull().default('user'),
	// admin | project_manager | designer | warehousing | user
	active: boolean('active').notNull().default(true),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
});

export const accounts = pgTable(
	'accounts',
	{
		userId: uuid('userId')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		type: text('type').notNull(),
		provider: text('provider').notNull(),
		providerAccountId: text('providerAccountId').notNull(),
		refresh_token: text('refresh_token'),
		access_token: text('access_token'),
		expires_at: integer('expires_at'),
		token_type: text('token_type'),
		scope: text('scope'),
		id_token: text('id_token'),
		session_state: text('session_state')
	},
	(t) => [unique('accounts_provider_uq').on(t.provider, t.providerAccountId)]
);

export const sessions = pgTable('sessions', {
	sessionToken: text('sessionToken').primaryKey(),
	userId: uuid('userId')
		.notNull()
		.references(() => users.id, { onDelete: 'cascade' }),
	expires: timestamp('expires', { withTimezone: true, mode: 'date' }).notNull()
});

export const verificationTokens = pgTable(
	'verificationToken',
	{
		identifier: text('identifier').notNull(),
		token: text('token').notNull(),
		expires: timestamp('expires', { withTimezone: true, mode: 'date' }).notNull()
	},
	(t) => [unique('verificationToken_identifier_token_uq').on(t.identifier, t.token)]
);

// ---------------------------------------------------------------------------
// Companies and their roles
// ---------------------------------------------------------------------------
// A single companies row represents any external organization (manufacturer,
// rep firm, client, GC, designer). Roles live in a junction so LOGIQ SUPPLY
// can be both manufacturer and rep_firm without ambiguity.

export const companies = pgTable('companies', {
	id: uuid('id').defaultRandom().primaryKey(),
	name: text('name').notNull().unique(),
	street: text('street'),
	city: text('city'),
	state: text('state'),
	zip: text('zip'),
	phone: text('phone'),
	website: text('website'),
	quoteEmails: text('quote_emails'),
	orderEmails: text('order_emails'),
	paymentTermsDays: integer('payment_terms_days'),
	ffa: numeric('ffa'), // free freight allowance
	creditLimit: numeric('credit_limit'),
	parentCompanyId: uuid('parent_company_id'),
	notes: text('notes'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	createdByUserId: uuid('created_by_user_id').references(() => users.id)
});

export const companyRoles = pgTable(
	'company_roles',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		companyId: uuid('company_id')
			.notNull()
			.references(() => companies.id, { onDelete: 'cascade' }),
		role: text('role').notNull()
		// role ∈ manufacturer | rep_firm | client | gc | designer
	},
	(t) => [unique('company_roles_uq').on(t.companyId, t.role)]
);

// People at rep firms (not application users — these are external sales reps).
export const reps = pgTable('reps', {
	id: uuid('id').defaultRandom().primaryKey(),
	repFirmCompanyId: uuid('rep_firm_company_id')
		.notNull()
		.references(() => companies.id, { onDelete: 'cascade' }),
	name: text('name'),
	quoteEmail: text('quote_email'),
	ordersEmail: text('orders_email'),
	phone: text('phone'),
	notes: text('notes')
});

// Which rep firms represent which manufacturers.
export const manufacturerRep = pgTable(
	'manufacturer_rep',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		manufacturerCompanyId: uuid('manufacturer_company_id')
			.notNull()
			.references(() => companies.id, { onDelete: 'cascade' }),
		repFirmCompanyId: uuid('rep_firm_company_id')
			.notNull()
			.references(() => companies.id, { onDelete: 'cascade' }),
		notes: text('notes')
	},
	(t) => [unique('manufacturer_rep_uq').on(t.manufacturerCompanyId, t.repFirmCompanyId)]
);

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------

export const projects = pgTable('projects', {
	id: uuid('id').defaultRandom().primaryKey(),
	name: text('name').notNull().unique(),
	status: text('status').notNull().default('active'),
	// active | completed | test | on_hold
	clientCompanyId: uuid('client_company_id').references(() => companies.id),
	gcCompanyId: uuid('gc_company_id').references(() => companies.id),
	designerCompanyId: uuid('designer_company_id').references(() => companies.id),
	projectManagerUserId: uuid('project_manager_user_id').references(() => users.id),

	marginPct: numeric('margin_pct'),
	freightPct: numeric('freight_pct'),
	warehousingPct: numeric('warehousing_pct'),
	salesTaxPct: numeric('sales_tax_pct'),

	deliveryStreet: text('delivery_street'),
	deliveryCity: text('delivery_city'),
	deliveryState: text('delivery_state'),
	deliveryZip: text('delivery_zip'),
	siteStreet: text('site_street'),
	siteCity: text('site_city'),
	siteState: text('site_state'),
	siteZip: text('site_zip'),

	totalSf: integer('total_sf'),
	interiorSf: integer('interior_sf'),
	exteriorSf: integer('exterior_sf'),

	designStartDate: timestamp('design_start_date', { withTimezone: true }),
	roughInStartDate: timestamp('rough_in_start_date', { withTimezone: true }),
	constructionStartDate: timestamp('construction_start_date', { withTimezone: true }),

	description: text('description'),
	notes: text('notes'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	createdByUserId: uuid('created_by_user_id').references(() => users.id)
});

export const projectRep = pgTable(
	'project_rep',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		projectId: uuid('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'cascade' }),
		repFirmCompanyId: uuid('rep_firm_company_id')
			.notNull()
			.references(() => companies.id, { onDelete: 'cascade' }),
		manufacturerCompanyId: uuid('manufacturer_company_id').references(() => companies.id, {
			onDelete: 'cascade'
		})
	},
	(t) => [unique('project_rep_uq').on(t.projectId, t.repFirmCompanyId, t.manufacturerCompanyId)]
);

// ---------------------------------------------------------------------------
// Types and Products
// ---------------------------------------------------------------------------

// Types are global to ILC (matches Tadabase's TYPES table behavior).
// A "TYPE" is the project-internal code (B1, C2, D12, EW3, ...).
export const types = pgTable('types', {
	id: uuid('id').defaultRandom().primaryKey(),
	name: text('name').notNull().unique(),
	family: text('family'),
	fixtureOrControl: text('fixture_or_control'), // FIXTURE | CONTROL
	masterVersion: text('master_version'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

export const products = pgTable(
	'products',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		manufacturerCompanyId: uuid('manufacturer_company_id').references(() => companies.id),
		catalogNo: text('catalog_no').notNull(),
		description: text('description'),
		finish: text('finish'),
		cct: text('cct'),
		wattage: text('wattage'),
		voltage: text('voltage'),
		dim: text('dim'),
		mounting: text('mounting'),
		fixtureOrControl: text('fixture_or_control'),
		notes: text('notes'),
		status: text('status'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [unique('products_mfr_catalog_uq').on(t.manufacturerCompanyId, t.catalogNo)]
);

// ---------------------------------------------------------------------------
// Import sessions (referenced by qap_lines for traceability)
// ---------------------------------------------------------------------------

export const importSessions = pgTable('import_sessions', {
	id: uuid('id').defaultRandom().primaryKey(),
	projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
	userId: uuid('user_id').references(() => users.id),
	sourceFilename: text('source_filename'),
	startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
	completedAt: timestamp('completed_at', { withTimezone: true }),
	totalRows: integer('total_rows'),
	rowsImported: integer('rows_imported'),
	rowsSkipped: integer('rows_skipped'),
	rowsFailed: integer('rows_failed'),
	status: text('status').notNull().default('pending_review'),
	// pending_review | importing | completed | failed | cancelled
	validationReport: jsonb('validation_report')
});

// ---------------------------------------------------------------------------
// QAP — the heart
// ---------------------------------------------------------------------------

export const qapLines = pgTable(
	'qap_lines',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		projectId: uuid('project_id')
			.notNull()
			.references(() => projects.id, { onDelete: 'restrict' }),
		typeId: uuid('type_id')
			.notNull()
			.references(() => types.id, { onDelete: 'restrict' }),
		productId: uuid('product_id')
			.notNull()
			.references(() => products.id, { onDelete: 'restrict' }),

		// Denormalized concat — "PROJECT - TYPE - CATALOG #". Generated by
		// app on insert/update; useful for display + import matching.
		qapIdText: text('qap_id_text'),

		qty: numeric('qty'),
		currentDn: numeric('current_dn'),
		marginPct: numeric('margin_pct'),

		fixtureOrControl: text('fixture_or_control'),
		finish: text('finish'),
		cct: text('cct'),
		wattage: text('wattage'),
		voltage: text('voltage'),
		dim: text('dim'),
		mounting: text('mounting'),
		roughInRequired: text('rough_in_required'),
		fixtureCategory: text('fixture_category'),
		fixtureLocation: text('fixture_location'),
		atticStock: text('attic_stock'),
		internalDesignerNotes: text('internal_designer_notes'),
		notes: text('notes'),
		description: text('description'),

		// Original designer-specified manufacturer/spec. Write-once on first
		// import; never overwritten on re-import or PM edit. Preserves the
		// audit trail of "what did the designer actually specify."
		prOriginalManufacturer: text('pr_original_manufacturer'),
		prOriginalSpec: text('pr_original_spec'),
		prOriginalSpecDetail: text('pr_original_spec_detail'),

		// Hash of the source CSV row's content. Re-imports with same hash skip;
		// changed hash triggers update.
		sourceRowHash: text('source_row_hash'),

		// Optimistic concurrency.
		rowVersion: bigint('row_version', { mode: 'number' }).notNull().default(1),

		lastImportSessionId: uuid('last_import_session_id').references(() => importSessions.id),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
		createdByUserId: uuid('created_by_user_id').references(() => users.id),
		updatedByUserId: uuid('updated_by_user_id').references(() => users.id)
	},
	(t) => [
		unique('qap_lines_project_type_product_uq').on(t.projectId, t.typeId, t.productId),
		index('qap_lines_project_idx').on(t.projectId),
		index('qap_lines_source_hash_idx').on(t.sourceRowHash)
	]
);

// ---------------------------------------------------------------------------
// Budgets (snapshot of QAP at a point in time)
// ---------------------------------------------------------------------------

export const budgets = pgTable('budgets', {
	id: uuid('id').defaultRandom().primaryKey(),
	projectId: uuid('project_id')
		.notNull()
		.references(() => projects.id, { onDelete: 'cascade' }),
	budgetNo: text('budget_no'),
	status: text('status').notNull().default('draft'),
	// draft | sent | confirmed | archived
	description: text('description'),
	marginPct: numeric('margin_pct'),
	freightPct: numeric('freight_pct'),
	warehousingPct: numeric('warehousing_pct'),
	salesTaxPct: numeric('sales_tax_pct'),
	notes: text('notes'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	createdByUserId: uuid('created_by_user_id').references(() => users.id)
});

export const budgetLines = pgTable('budget_lines', {
	id: uuid('id').defaultRandom().primaryKey(),
	budgetId: uuid('budget_id')
		.notNull()
		.references(() => budgets.id, { onDelete: 'cascade' }),
	qapLineId: uuid('qap_line_id')
		.notNull()
		.references(() => qapLines.id, { onDelete: 'restrict' }),

	// Snapshot of QAP values at budget-creation time.
	typeNameSnapshot: text('type_name_snapshot'),
	catalogNoSnapshot: text('catalog_no_snapshot'),
	manufacturerNameSnapshot: text('manufacturer_name_snapshot'),
	descriptionSnapshot: text('description_snapshot'),
	qtySnapshot: numeric('qty_snapshot'),
	currentDnSnapshot: numeric('current_dn_snapshot'),
	marginPctSnapshot: numeric('margin_pct_snapshot'),

	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
});

// ---------------------------------------------------------------------------
// Cell-level audit log
// ---------------------------------------------------------------------------
// One row per cell change, not per row change. Keeps the table size proportional
// to actual edits and matches the dirty-cell mental model of the bulk-save UX.

export const auditCells = pgTable(
	'audit_cells',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		userId: uuid('user_id').references(() => users.id),
		tableName: text('table_name').notNull(),
		rowId: uuid('row_id').notNull(),
		columnName: text('column_name').notNull(),
		operation: text('operation').notNull(),
		// insert | update | delete
		oldValue: jsonb('old_value'),
		newValue: jsonb('new_value'),
		changedAt: timestamp('changed_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('audit_cells_row_idx').on(t.tableName, t.rowId),
		index('audit_cells_user_idx').on(t.userId)
	]
);

// ---------------------------------------------------------------------------
// Type helpers
// ---------------------------------------------------------------------------

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type QapLine = typeof qapLines.$inferSelect;
export type NewQapLine = typeof qapLines.$inferInsert;
export type ImportSession = typeof importSessions.$inferSelect;

// Suppress unused-import warning for sql helper (referenced from migrations).
void sql;
