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
	index,
	primaryKey
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
	// QBO integration. A company can be both a Customer and a Vendor in QBO
	// (e.g. LOGIQ SUPPLY is your manufacturer rep, but might also pay you
	// for something one day). Filled in by a PM-driven "link to QBO" action
	// once the QBO push integration ships. Null = not linked yet; push will
	// refuse to send until a link exists.
	qboCustomerId: text('qbo_customer_id'),
	qboVendorId: text('qbo_vendor_id'),
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
	phase: text('phase'),
	// SD | DD | CD | CA | bidding | construction | closeout
	projectType: text('project_type'),
	// Hospitality | Multifamily | Office | Retail | Education | ...

	clientCompanyId: uuid('client_company_id').references(() => companies.id),
	gcCompanyId: uuid('gc_company_id').references(() => companies.id),
	designerCompanyId: uuid('designer_company_id').references(() => companies.id),
	projectManagerUserId: uuid('project_manager_user_id').references(() => users.id),

	// Additional staff roles surfaced on the project sheet
	designLeadUserId: uuid('design_lead_user_id').references(() => users.id),
	secondDesignerUserId: uuid('second_designer_user_id').references(() => users.id),
	salesPersonUserId: uuid('sales_person_user_id').references(() => users.id),
	caManagerUserId: uuid('ca_manager_user_id').references(() => users.id),

	// Service offering applied to this project — Full Service Design, etc.
	serviceType: text('service_type'),

	// Top-line dates
	ifcSubDate: timestamp('ifc_sub_date', { withTimezone: true }),
	expectedOrderDate: timestamp('expected_order_date', { withTimezone: true }),
	designStartDate: timestamp('design_start_date', { withTimezone: true }),
	roughInStartDate: timestamp('rough_in_start_date', { withTimezone: true }),
	constructionStartDate: timestamp('construction_start_date', { withTimezone: true }),

	// Financial defaults / overrides
	marginPct: numeric('margin_pct'),
	freightPct: numeric('freight_pct'),
	warehousingPct: numeric('warehousing_pct'),
	salesTaxPct: numeric('sales_tax_pct'),
	salesTaxName: text('sales_tax_name'),
	// Human label for the tax rate, e.g. "2.9% — CO STATE" or
	// "8% — STOCKBRIDGE, GA". Mirrored to invoices at creation.
	projectedDesignFeeTotal: numeric('projected_design_fee_total'),
	// Top-level forecast of design fee revenue. Distinct from the
	// running total computed from design-fee invoices.
	targetBudgetTotal: numeric('target_budget_total'),
	// Top-line product-budget target. Budgets compare against this.
	targetDollarsPerSf: numeric('target_dollars_per_sf'),
	// Target $/SF for the project. Budget detail page shows actual vs target.

	// Project-level email overrides — when set, these win over the
	// company-default emails (which apply when a project doesn't override)
	emailsForBudgets: text('emails_for_budgets'),
	emailsForQuotesSo: text('emails_for_quotes_so'),
	emailsForShipmentUpdates: text('emails_for_shipment_updates'),

	// Delivery address (where ILC ships TO — warehouse, GC, or jobsite)
	deliveryStreet: text('delivery_street'),
	deliveryCity: text('delivery_city'),
	deliveryState: text('delivery_state'),
	deliveryZip: text('delivery_zip'),
	deliverySiteContactName: text('delivery_site_contact_name'),
	deliverySiteContactPhone: text('delivery_site_contact_phone'),

	// Job site address (the physical building — drives sales tax jurisdiction)
	siteStreet: text('site_street'),
	siteCity: text('site_city'),
	siteState: text('site_state'),
	siteZip: text('site_zip'),
	jobSiteContactName: text('job_site_contact_name'),
	jobSiteContactPhone: text('job_site_contact_phone'),

	// Square footage — top-line + supplemental breakdowns
	totalSf: integer('total_sf'),
	interiorSf: integer('interior_sf'),
	exteriorSf: integer('exterior_sf'),
	numUnitsRooms: integer('num_units_rooms'),
	unitRoomSf: integer('unit_room_sf'),
	garageSf: integer('garage_sf'),
	bohSf: integer('boh_sf'),
	openOfficeSf: integer('open_office_sf'),
	privateOfficeSf: integer('private_office_sf'),
	corridorAreaSf: integer('corridor_area_sf'),
	amenityAreaSf: integer('amenity_area_sf'),
	unfinishedOfficeSf: integer('unfinished_office_sf'),

	description: text('description'),
	notes: text('notes'),
	projectStats: text('project_stats'),
	// Free-form internal note — used in TrackVia for tax/permit notes
	// distinct from `notes` (which tends to hold scoping/design notes).

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
		// QBO Item link. Populated on first push: get-or-create against QBO's
		// Item list, then store the ID for idempotent subsequent pushes.
		qboItemId: text('qbo_item_id'),
		qboStatus: text('qbo_status').notNull().default('not_pushed'),
		// not_pushed | queued | pushed | failed
		qboPushedAt: timestamp('qbo_pushed_at', { withTimezone: true }),
		qboLastError: text('qbo_last_error'),
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

		// ShipQAP planning fields — forward-looking, PM-managed expectations.
		// Decoupled from the shipments table because Olivia needs to log these
		// before a PO exists. Coexists with real shipments: these are "what was
		// planned," shipments are "what actually happened."
		expectedShipDate: timestamp('expected_ship_date', { withTimezone: true }),
		expectedArrivalDate: timestamp('expected_arrival_date', { withTimezone: true }),
		expectedShipNotes: text('expected_ship_notes'),

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
// ShipQAP — per-user hide list
// ---------------------------------------------------------------------------
// Each PM curates their own ShipQAP view by hiding lines they don't want to
// see. Junction table because the underlying QAP line shouldn't know or care
// who's hidden it — and the same line can be hidden by some PMs but not
// others. Composite PK (user_id, qap_line_id) makes "toggle hide" trivially
// idempotent via DELETE + INSERT or upsert.
export const shipQapHiddenLines = pgTable(
	'ship_qap_hidden_lines',
	{
		userId: uuid('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		qapLineId: uuid('qap_line_id')
			.notNull()
			.references(() => qapLines.id, { onDelete: 'cascade' }),
		hiddenAt: timestamp('hidden_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		primaryKey({ columns: [t.userId, t.qapLineId] }),
		index('ship_qap_hidden_lines_user_idx').on(t.userId)
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
	budgetNo: text('budget_no').notNull().unique(),
	// e.g. "BU00123"
	status: text('status').notNull().default('draft'),
	// draft | sent | confirmed | archived
	description: text('description'),
	// Free-text label — e.g. "FINAL UPDATE", "SUBMITTAL & RFI UPDATES", "GMP SET",
	// "IFC SET", "PERMIT SET". Sean's team versions budgets at design milestones.

	marginPct: numeric('margin_pct'),
	freightPct: numeric('freight_pct'),
	warehousingPct: numeric('warehousing_pct'),
	salesTaxPct: numeric('sales_tax_pct'),
	// Per-budget overrides; default-copy from project at creation.

	notes: text('notes'),
	rowVersion: bigint('row_version', { mode: 'number' }).notNull().default(1),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	createdByUserId: uuid('created_by_user_id').references(() => users.id)
});

export const budgetLines = pgTable(
	'budget_lines',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		budgetId: uuid('budget_id')
			.notNull()
			.references(() => budgets.id, { onDelete: 'cascade' }),
		// QAP line is the snapshot source. set null on QAP deletion so historical
		// budgets don't lose their data — the snapshot fields stay populated.
		qapLineId: uuid('qap_line_id').references(() => qapLines.id, { onDelete: 'set null' }),

		// Snapshot of QAP values at budget-creation time.
		typeNameSnapshot: text('type_name_snapshot'),
		catalogNoSnapshot: text('catalog_no_snapshot'),
		manufacturerNameSnapshot: text('manufacturer_name_snapshot'),
		descriptionSnapshot: text('description_snapshot'),
		qtySnapshot: numeric('qty_snapshot'),
		qtyTypeSnapshot: text('qty_type_snapshot'),
		currentDnSnapshot: numeric('current_dn_snapshot'),
		marginPctSnapshot: numeric('margin_pct_snapshot'),
		// Editable per-budget — PMs can tweak qty/unit_dn on a budget without
		// touching the QAP. Useful for "what-if" budgeting.
		qty: numeric('qty'),
		unitDn: numeric('unit_dn'),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('budget_lines_budget_idx').on(t.budgetId),
		index('budget_lines_qap_idx').on(t.qapLineId)
	]
);

// ---------------------------------------------------------------------------
// RFQs (Request For Quote)
// ---------------------------------------------------------------------------
// A PM picks QAP lines they want priced and sends an RFQ to a rep firm. The
// rep firm (a company with role='rep_firm') quotes back. Quoted DNs flow
// into qap_lines.current_dn (via a manual PM action on the QAP grid), they
// don't auto-update — preserving the QAP-is-source-of-truth invariant.

export const rfqs = pgTable('rfqs', {
	id: uuid('id').defaultRandom().primaryKey(),
	projectId: uuid('project_id')
		.notNull()
		.references(() => projects.id, { onDelete: 'cascade' }),
	repFirmCompanyId: uuid('rep_firm_company_id').references(() => companies.id),
	rfqNo: text('rfq_no').notNull().unique(),
	// e.g. "RFQ00001"
	status: text('status').notNull().default('draft'),
	// draft | sent | quoted | accepted | declined | cancelled
	notes: text('notes'),
	sentAt: timestamp('sent_at', { withTimezone: true }),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	createdByUserId: uuid('created_by_user_id').references(() => users.id)
});

export const rfqLines = pgTable(
	'rfq_lines',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		rfqId: uuid('rfq_id')
			.notNull()
			.references(() => rfqs.id, { onDelete: 'cascade' }),
		qapLineId: uuid('qap_line_id')
			.notNull()
			.references(() => qapLines.id, { onDelete: 'restrict' }),

		// Snapshot of QAP values at RFQ creation. qtySnapshot is editable
		// per-RFQ (PMs commonly adjust the requested qty before sending);
		// the other snapshot fields are read-only.
		qtySnapshot: numeric('qty_snapshot'),
		// Unit of measure for qty: EA, LF, KIT, SET, etc. Free text; common
		// values surfaced as a datalist in the UI.
		qtyType: text('qty_type'),
		typeNameSnapshot: text('type_name_snapshot'),
		catalogNoSnapshot: text('catalog_no_snapshot'),
		manufacturerNameSnapshot: text('manufacturer_name_snapshot'),
		descriptionSnapshot: text('description_snapshot'),

		// Filled in when the rep quotes back. The PM manually pushes this to
		// qap_lines.current_dn from the RFQ page when they accept the quote.
		quotedDn: numeric('quoted_dn'),
		quoteReceivedAt: timestamp('quote_received_at', { withTimezone: true }),
		// Tracks when this line's quoted_dn was promoted to qap_lines.current_dn.
		// Null = quote not yet applied; non-null = already pushed to QAP.
		appliedToQapAt: timestamp('applied_to_qap_at', { withTimezone: true }),
		appliedToQapByUserId: uuid('applied_to_qap_by_user_id').references(() => users.id),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		unique('rfq_lines_rfq_qap_uq').on(t.rfqId, t.qapLineId),
		index('rfq_lines_rfq_idx').on(t.rfqId),
		index('rfq_lines_qap_idx').on(t.qapLineId)
	]
);

// ---------------------------------------------------------------------------
// Sales Orders + Purchase Orders + shared order_lines
// ---------------------------------------------------------------------------
// An SO is the document ILC sends the contractor — CN (client-net) columns are
// first-class. A PO is the document ILC sends the rep firm — DN (dealer-net)
// columns are first-class. Both render the SAME line items via the order_lines
// table: editing on either side updates the shared row. That's the
// bidirectional-sync invariant from the brief, implemented structurally rather
// than via application code.
//
// One SO can have N POs (one per rep firm when an SO needs items from multiple
// suppliers). Each order_line has one SO (required) and at most one PO (PO is
// nullable until "Create POs from SO" is run).

export const salesOrders = pgTable('sales_orders', {
	id: uuid('id').defaultRandom().primaryKey(),
	projectId: uuid('project_id')
		.notNull()
		.references(() => projects.id, { onDelete: 'cascade' }),
	soNo: text('so_no').notNull().unique(),
	// e.g. "SO00001" — app-generated, monotonic per ILC tenant

	status: text('status').notNull().default('draft'),
	// draft | confirmed | shipped | invoiced | closed | cancelled

	description: text('description'),
	notes: text('notes'),
	customEmailMessage: text('custom_email_message'),
	procurementMgrUserId: uuid('procurement_mgr_user_id').references(() => users.id),

	// Per-SO override percentages. Defaults copied from project at SO creation;
	// PM can adjust per-SO. NULL means "fall back to project default at render."
	marginPct: numeric('margin_pct'),
	freightPct: numeric('freight_pct'),
	warehousingPct: numeric('warehousing_pct'),
	salesTaxPct: numeric('sales_tax_pct'),
	salesTaxName: text('sales_tax_name'),
	// Categorical bucket name from the sales-tax master list (snapshot, not FK).
	additionalFreight: numeric('additional_freight'),
	freightOverride: numeric('freight_override'),
	// Dollar overrides on top of the % calculation.

	sentAt: timestamp('sent_at', { withTimezone: true }),
	confirmedAt: timestamp('confirmed_at', { withTimezone: true }),

	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	createdByUserId: uuid('created_by_user_id').references(() => users.id)
});

export const purchaseOrders = pgTable('purchase_orders', {
	id: uuid('id').defaultRandom().primaryKey(),
	projectId: uuid('project_id')
		.notNull()
		.references(() => projects.id, { onDelete: 'cascade' }),
	salesOrderId: uuid('sales_order_id').references(() => salesOrders.id, {
		onDelete: 'set null'
	}),
	// PO may briefly survive SO deletion (rare); set null on SO deletion.
	repFirmCompanyId: uuid('rep_firm_company_id').references(() => companies.id),

	poNo: text('po_no').notNull().unique(),
	// e.g. "PO00001"

	status: text('status').notNull().default('draft'),
	// draft | sent | acknowledged | shipped | received | closed | cancelled | dont_send
	// 'dont_send' = "DON'T SEND PO - CREATE SHIPMENTS" — internal-only PO

	description: text('description'),
	notes: text('notes'),
	internalNotes: text('internal_notes'),
	// Internal notes are NEVER included in the rep email; PMs use them for
	// freight haggling, partial-ship strategy, etc.
	customEmailMessage: text('custom_email_message'),

	addedFreight: numeric('added_freight'),
	repQuoteNo: text('rep_quote_no'),
	// PO-level override. Per-line rep_quote_no on order_lines is the source of
	// truth; this is a hand-typed override when the rep references the whole PO
	// with a single quote #.

	trackingNumber: text('tracking_number'),
	orderedDate: timestamp('ordered_date', { withTimezone: true }),
	acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),

	// Per-PO shipping address override. Defaults blank; PM fills in for
	// job-site direct deliveries (Tadabase examples showed contact name +
	// company + phone + street). Stored as free text; can normalize later.
	shipToText: text('ship_to_text'),
	ilcOfficeAddress: text('ilc_office_address'),
	sendFromEmail: text('send_from_email'),
	sendToEmail: text('send_to_email'),

	sentAt: timestamp('sent_at', { withTimezone: true }),
	versionNo: integer('version_no').notNull().default(1),
	// Incremented when a Change Order modifies the PO. CO not built yet; column
	// exists for future without requiring a migration later.

	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	createdByUserId: uuid('created_by_user_id').references(() => users.id)
});

export const orderLines = pgTable(
	'order_lines',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		salesOrderId: uuid('sales_order_id')
			.notNull()
			.references(() => salesOrders.id, { onDelete: 'cascade' }),
		purchaseOrderId: uuid('purchase_order_id').references(() => purchaseOrders.id, {
			onDelete: 'set null'
		}),
		// NULL until "Create POs from SO" is run.

		qapLineId: uuid('qap_line_id').references(() => qapLines.id, { onDelete: 'set null' }),
		// Origin in QAP. Nullable so QAP deletion doesn't destroy SO/PO history.
		rfqLineId: uuid('rfq_line_id').references(() => rfqLines.id, { onDelete: 'set null' }),
		// Optional: the RFQ line whose quoted_dn became this line's unit_dn.

		// Snapshots from QAP at line creation.
		typeNameSnapshot: text('type_name_snapshot'),
		catalogNoSnapshot: text('catalog_no_snapshot'),
		manufacturerNameSnapshot: text('manufacturer_name_snapshot'),
		descriptionSnapshot: text('description_snapshot'),

		// Shared editable fields. Mutating any of these from either the SO view
		// or the PO view updates this row — both views render fresh data on
		// next load. That's the bidirectional sync.
		qty: numeric('qty'),
		qtyType: text('qty_type'),
		unitDn: numeric('unit_dn'),
		unitCn: numeric('unit_cn'),
		// unit_cn = unit_dn × (1 + margin_pct/100) by default but can be hand-set
		// to break the relationship if the PM wants to.
		marginPct: numeric('margin_pct'),
		// Per-line margin override. NULL means "fall back to SO's margin_pct."
		repQuoteNo: text('rep_quote_no'),

		rowVersion: bigint('row_version', { mode: 'number' }).notNull().default(1),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
		createdByUserId: uuid('created_by_user_id').references(() => users.id),
		updatedByUserId: uuid('updated_by_user_id').references(() => users.id)
	},
	(t) => [
		index('order_lines_so_idx').on(t.salesOrderId),
		index('order_lines_po_idx').on(t.purchaseOrderId),
		index('order_lines_qap_idx').on(t.qapLineId),
		index('order_lines_rfq_idx').on(t.rfqLineId)
	]
);

// ---------------------------------------------------------------------------
// Shipments — partial-line tracking
// ---------------------------------------------------------------------------
// A shipment is one physical delivery from one rep firm for one PO. A PO can
// have many shipments because manufacturers commonly split deliveries (50 now,
// 50 in six weeks). Each shipment is composed of shipment_lines, one per PO
// line that's actually on this delivery, with a qty_shipped that can be less
// than the line's qty (partial). The "received qty per order_line" rollup is
// computed live from SUM(shipment_lines.qty_shipped) where shipments.status
// is 'received' — never denormalized to avoid sync bugs.

export const shipments = pgTable('shipments', {
	id: uuid('id').defaultRandom().primaryKey(),
	projectId: uuid('project_id')
		.notNull()
		.references(() => projects.id, { onDelete: 'cascade' }),
	purchaseOrderId: uuid('purchase_order_id')
		.notNull()
		.references(() => purchaseOrders.id, { onDelete: 'cascade' }),

	shipmentNo: text('shipment_no').notNull().unique(),
	// e.g. "SHP00001" — global sequence.

	status: text('status').notNull().default('expected'),
	// expected | in_transit | received | partial | cancelled
	// 'partial' is for an arrived-but-short shipment that the PM has logged
	// without marking fully received (e.g. damaged box still being investigated).

	carrier: text('carrier'),
	trackingNumber: text('tracking_number'),
	expectedDate: timestamp('expected_date', { withTimezone: true }),
	shippedDate: timestamp('shipped_date', { withTimezone: true }),
	receivedDate: timestamp('received_date', { withTimezone: true }),
	// Auto-stamped when status flips to 'received' for the first time.

	receivedAtLocation: text('received_at_location'),
	// Free text — 'warehouse', 'jobsite', '123 Main St', etc. PMs use this to
	// know where the boxes actually are.

	notes: text('notes'),
	internalNotes: text('internal_notes'),

	rowVersion: bigint('row_version', { mode: 'number' }).notNull().default(1),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	createdByUserId: uuid('created_by_user_id').references(() => users.id),
	receivedByUserId: uuid('received_by_user_id').references(() => users.id)
});

export const shipmentLines = pgTable(
	'shipment_lines',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		shipmentId: uuid('shipment_id')
			.notNull()
			.references(() => shipments.id, { onDelete: 'cascade' }),
		orderLineId: uuid('order_line_id')
			.notNull()
			.references(() => orderLines.id, { onDelete: 'cascade' }),

		qtyShipped: numeric('qty_shipped').notNull(),
		// Quantity on THIS shipment. Sum across all received shipments for an
		// order_line = total received. Can be less than the order_line's qty
		// (partial shipment) and can in theory exceed it (over-ship — manufacturer
		// sent extras). The UI warns on over-ship but doesn't block.

		notes: text('notes'),
		// Per-line notes — "missing 2 lenses", "wrong finish on 5", etc.

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('shipment_lines_shipment_idx').on(t.shipmentId),
		index('shipment_lines_order_line_idx').on(t.orderLineId),
		unique('shipment_lines_shipment_order_line_uq').on(t.shipmentId, t.orderLineId)
		// A given order_line can appear AT MOST once per shipment. If you ship
		// the line in two waves, that's two shipments, not two rows on one.
	]
);

// ---------------------------------------------------------------------------
// Change Orders — versioned modifications to a sent PO
// ---------------------------------------------------------------------------
// A CO captures a delta against a PO that's already been sent. Each CO bumps
// the PO's version_no when applied. Common cases: add a missed line, remove
// an over-ordered line, modify qty/price/spec.
//
// Only one open CO per PO at a time (enforced in the action, not the schema).
// COs preserve their own before/after snapshot per line so the historical
// record is immutable even if the underlying order_lines later mutate again.

export const changeOrders = pgTable('change_orders', {
	id: uuid('id').defaultRandom().primaryKey(),
	projectId: uuid('project_id')
		.notNull()
		.references(() => projects.id, { onDelete: 'cascade' }),
	purchaseOrderId: uuid('purchase_order_id')
		.notNull()
		.references(() => purchaseOrders.id, { onDelete: 'cascade' }),

	coNo: text('co_no').notNull().unique(),
	// e.g. "CO00123"

	versionNoBefore: integer('version_no_before').notNull(),
	// The PO version this CO is amending. Snapshot from purchase_orders.version_no
	// at CO creation.
	versionNoAfter: integer('version_no_after'),
	// What the PO version becomes after the CO applies. Filled in on apply.

	status: text('status').notNull().default('draft'),
	// draft | sent | acknowledged | rejected | applied | cancelled

	description: text('description'),
	// PM's explanation — why does this CO exist?
	reason: text('reason'),
	// Optional category — add_lines | remove_lines | qty_change | price_change
	// | spec_change | other. Free text for now; could enum later.
	customEmailMessage: text('custom_email_message'),

	netAmountChange: numeric('net_amount_change').default('0'),
	// $ delta vs as-sent PO total. Computed at line save.

	sentAt: timestamp('sent_at', { withTimezone: true }),
	acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
	appliedAt: timestamp('applied_at', { withTimezone: true }),
	rejectedAt: timestamp('rejected_at', { withTimezone: true }),
	rejectedReason: text('rejected_reason'),

	appliedByUserId: uuid('applied_by_user_id').references(() => users.id),

	// QBO push state — when a CO needs to update the QBO PO record.
	// Not all COs push (some are pre-acknowledgement spec fixes).
	qboId: text('qbo_id'),
	qboStatus: text('qbo_status').notNull().default('not_pushed'),
	qboPushedAt: timestamp('qbo_pushed_at', { withTimezone: true }),
	qboLastError: text('qbo_last_error'),

	rowVersion: bigint('row_version', { mode: 'number' }).notNull().default(1),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	createdByUserId: uuid('created_by_user_id').references(() => users.id)
});

export const changeOrderLines = pgTable(
	'change_order_lines',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		changeOrderId: uuid('change_order_id')
			.notNull()
			.references(() => changeOrders.id, { onDelete: 'cascade' }),
		orderLineId: uuid('order_line_id').references(() => orderLines.id, {
			onDelete: 'set null'
		}),
		// For operation='add', this is NULL until apply (then it gets the new line's id).
		// For 'remove' and 'modify', it's the line being changed.

		operation: text('operation').notNull(),
		// add | remove | modify

		// Snapshot of the line BEFORE this CO. For operation='add', all "_before"
		// fields are NULL.
		typeBefore: text('type_before'),
		catalogNoBefore: text('catalog_no_before'),
		manufacturerBefore: text('manufacturer_before'),
		descriptionBefore: text('description_before'),
		qtyBefore: numeric('qty_before'),
		qtyTypeBefore: text('qty_type_before'),
		unitDnBefore: numeric('unit_dn_before'),

		// Snapshot of the line AFTER this CO. For operation='remove', all "_after"
		// fields are NULL.
		typeAfter: text('type_after'),
		catalogNoAfter: text('catalog_no_after'),
		manufacturerAfter: text('manufacturer_after'),
		descriptionAfter: text('description_after'),
		qtyAfter: numeric('qty_after'),
		qtyTypeAfter: text('qty_type_after'),
		unitDnAfter: numeric('unit_dn_after'),

		lineTotalDelta: numeric('line_total_delta'),
		// $ delta this line contributes to the CO's net_amount_change.
		// Computed at save: (qty_after * unit_dn_after) - (qty_before * unit_dn_before),
		// with NULLs treated as 0 for adds/removes.

		reasonText: text('reason_text'),
		// Per-line explanation (e.g. "manufacturer raised price 8% on 2026-04").

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('change_order_lines_co_idx').on(t.changeOrderId),
		index('change_order_lines_order_line_idx').on(t.orderLineId)
	]
);

// ---------------------------------------------------------------------------
// Receivable invoices — what ILC bills the client
// ---------------------------------------------------------------------------
// Invoices come into existence when the PM clicks "+ New invoice" on an SO
// (for product invoices) or on a project (for design fee / credit memo).
// Progress billing is first-class: one SO can have many invoices, each
// billing a subset of any order line at any qty. The "type" column
// discriminates between product, design fee, and credit memo invoices —
// all share the same IN##### numbering sequence so PMs see one list.
//
// QBO state is orthogonal to workflow state: `status` tracks ILC's view
// (draft → sent → paid), while `qbo_status` tracks whether the invoice has
// been pushed to the accounting book.

export const invoices = pgTable('invoices', {
	id: uuid('id').defaultRandom().primaryKey(),
	projectId: uuid('project_id')
		.notNull()
		.references(() => projects.id, { onDelete: 'cascade' }),
	salesOrderId: uuid('sales_order_id').references(() => salesOrders.id, {
		onDelete: 'set null'
	}),
	// Required for type=product, NULL for type=design_fee / credit_memo.

	invoiceNo: text('invoice_no').notNull().unique(),
	// e.g. "IN00123"

	type: text('type').notNull().default('product'),
	// product | design_fee | credit_memo

	status: text('status').notNull().default('draft'),
	// draft | sent | partial_paid | paid | past_due | void

	// Design fee invoices only — which phase milestone this bills.
	designPhase: text('design_phase'),

	invoiceDate: timestamp('invoice_date', { withTimezone: true }),
	dueDate: timestamp('due_date', { withTimezone: true }),

	// Per-invoice CLIENT PO # override. The project also has a master
	// client_po_no; this one is for clients who issue separate POs per
	// progress-billing milestone.
	clientPoNo: text('client_po_no'),

	// Sales tax — copied off the project at creation but PM can override
	// (jobsite tax jurisdiction occasionally differs from project default).
	salesTaxPct: numeric('sales_tax_pct'),
	salesTaxName: text('sales_tax_name'),

	// Money amounts applied against this invoice
	depositAppliedAmount: numeric('deposit_applied_amount').default('0'),
	creditAppliedAmount: numeric('credit_applied_amount').default('0'),
	// `total_amount` is the gross before credits/deposits. `amount_due`
	// = total_amount - deposit_applied_amount - credit_applied_amount.
	// Stored explicitly to match QBO snapshot.
	totalAmount: numeric('total_amount').default('0'),
	amountDue: numeric('amount_due').default('0'),
	paidAmount: numeric('paid_amount').default('0'),

	sentAt: timestamp('sent_at', { withTimezone: true }),
	paidAt: timestamp('paid_at', { withTimezone: true }),

	// QBO push state
	qboId: text('qbo_id'),
	qboStatus: text('qbo_status').notNull().default('not_pushed'),
	// not_pushed | queued | pushed | failed
	qboPushedAt: timestamp('qbo_pushed_at', { withTimezone: true }),
	qboLastError: text('qbo_last_error'),

	rowVersion: bigint('row_version', { mode: 'number' }).notNull().default(1),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	createdByUserId: uuid('created_by_user_id').references(() => users.id)
});

export const invoiceLines = pgTable(
	'invoice_lines',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		invoiceId: uuid('invoice_id')
			.notNull()
			.references(() => invoices.id, { onDelete: 'cascade' }),
		// For product invoices: links back to the order line being billed.
		// For design fee / credit memo: NULL.
		orderLineId: uuid('order_line_id').references(() => orderLines.id, {
			onDelete: 'set null'
		}),
		// Optional link to a specific shipment line — useful when an invoice
		// covers a particular delivery event.
		shipmentLineId: uuid('shipment_line_id').references(() => shipmentLines.id, {
			onDelete: 'set null'
		}),

		// Snapshot fields — captured at line creation, never re-pulled from
		// source so historical invoices stay accurate even if products / SOs
		// later change.
		typeSnapshot: text('type_snapshot'),
		catalogNoSnapshot: text('catalog_no_snapshot'),
		manufacturerSnapshot: text('manufacturer_snapshot'),
		descriptionSnapshot: text('description_snapshot'),

		qtyInvoiced: numeric('qty_invoiced'),
		// Can be less than the source order line's qty — that's progress
		// billing. The PM can also use this for partial credit memos.
		qtyType: text('qty_type'),
		unitDnSnapshot: numeric('unit_dn_snapshot'),
		unitCnSnapshot: numeric('unit_cn_snapshot'),
		marginPctSnapshot: numeric('margin_pct_snapshot'),
		lineTotal: numeric('line_total'),
		// Computed at save time. Stored so QBO push and totals queries don't
		// re-derive on every read.

		// Design fee invoice lines use this instead of catalog snapshots.
		designFeeDescription: text('design_fee_description'),

		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('invoice_lines_invoice_idx').on(t.invoiceId),
		index('invoice_lines_order_line_idx').on(t.orderLineId)
	]
);

// ---------------------------------------------------------------------------
// Payable bills — what ILC owes manufacturers / rep firms
// ---------------------------------------------------------------------------
// Bills arrive via two paths:
//   1. DocParser webhook — OCR'd from a PDF emailed to a forward-address;
//      lands as `status='pending_review'` with the raw extracted JSON
//      preserved on `source_parsed_json` for auditability
//   2. Manual entry — PM fills in fields themselves
//
// PM reviews / corrects, then approves. On approval, QBO push fires.
// PO number is the join key — DocParser extracts the PO# from the bill and
// we look up the matching purchase_orders row by it.

export const bills = pgTable('bills', {
	id: uuid('id').defaultRandom().primaryKey(),
	projectId: uuid('project_id').references(() => projects.id, { onDelete: 'cascade' }),
	// NULL when DocParser delivers a bill we can't match to a PO yet.
	purchaseOrderId: uuid('purchase_order_id').references(() => purchaseOrders.id, {
		onDelete: 'set null'
	}),
	vendorCompanyId: uuid('vendor_company_id').references(() => companies.id),
	// The rep firm / manufacturer that sent the bill.

	billNo: text('bill_no').notNull().unique(),
	// Our internal ID, e.g. "BL00123".
	vendorBillNo: text('vendor_bill_no'),
	// The number the vendor uses on their own bill PDF. Free text.

	billDate: timestamp('bill_date', { withTimezone: true }),
	dueDate: timestamp('due_date', { withTimezone: true }),

	status: text('status').notNull().default('pending_review'),
	// pending_review | approved | scheduled | paid | rejected | void
	// 'pending_review' = DocParser dropped it here; PM hasn't looked yet
	// 'approved' = PM verified fields against source PDF and OK'd
	// 'scheduled' = approved and queued for payment in QBO
	// 'paid' = QBO marked it paid

	totalAmount: numeric('total_amount'),
	paidAmount: numeric('paid_amount'),

	// Free-form notes from PM (internal) — never goes anywhere external.
	notes: text('notes'),

	// Provenance for audit
	sourcePdfUrl: text('source_pdf_url'),
	// Where the original bill PDF lives (S3 path or DocParser ref).
	sourceParsedJson: jsonb('source_parsed_json'),
	// Raw extraction output. Lets PM see "what DocParser thought" if a
	// field looks wrong, and lets us debug OCR misses.

	approvedByUserId: uuid('approved_by_user_id').references(() => users.id),
	approvedAt: timestamp('approved_at', { withTimezone: true }),
	rejectedByUserId: uuid('rejected_by_user_id').references(() => users.id),
	rejectedAt: timestamp('rejected_at', { withTimezone: true }),
	rejectedReason: text('rejected_reason'),

	// QBO push state (same shape as invoices)
	qboId: text('qbo_id'),
	qboStatus: text('qbo_status').notNull().default('not_pushed'),
	qboPushedAt: timestamp('qbo_pushed_at', { withTimezone: true }),
	qboLastError: text('qbo_last_error'),

	rowVersion: bigint('row_version', { mode: 'number' }).notNull().default(1),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
	createdByUserId: uuid('created_by_user_id').references(() => users.id)
});

export const billLines = pgTable(
	'bill_lines',
	{
		id: uuid('id').defaultRandom().primaryKey(),
		billId: uuid('bill_id')
			.notNull()
			.references(() => bills.id, { onDelete: 'cascade' }),
		// Optional FK back to the PO line we matched this bill line against.
		// NULL = PM hasn't matched it yet (or no match exists — manufacturer
		// billed something not on the PO).
		orderLineId: uuid('order_line_id').references(() => orderLines.id, {
			onDelete: 'set null'
		}),

		// What DocParser (or PM) read off the bill
		descriptionText: text('description_text'),
		catalogNoText: text('catalog_no_text'),
		qty: numeric('qty'),
		unitPrice: numeric('unit_price'),
		lineTotal: numeric('line_total'),

		notes: text('notes'),
		createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()
	},
	(t) => [
		index('bill_lines_bill_idx').on(t.billId),
		index('bill_lines_order_line_idx').on(t.orderLineId)
	]
);

// ---------------------------------------------------------------------------
// Client credits — running tally of money a client has on file
// ---------------------------------------------------------------------------
// Source of three flows:
//   - DEPOSIT: client paid ahead and has a balance to draw from
//   - CREDIT_MEMO: ILC issued a credit invoice (negative amount)
//   - REFUND: ILC refunded money the client had previously paid
//   - MANUAL: PM-entered adjustment for anything not the above
//
// Ebisu records additions and applications; the running balance is
// computed (SUM(amount) where origin in (deposit, credit_memo, refund,
// manual) MINUS the sum of `invoices.credit_applied_amount` where the
// invoice cited this credit). QBO is the authoritative ledger; this is
// just enough state for the PM workbench to suggest "client X has $Y
// available — apply to this invoice?"

export const clientCredits = pgTable('client_credits', {
	id: uuid('id').defaultRandom().primaryKey(),
	clientCompanyId: uuid('client_company_id')
		.notNull()
		.references(() => companies.id, { onDelete: 'restrict' }),

	creditNo: text('credit_no').notNull().unique(),
	// e.g. "CR00123"

	amount: numeric('amount').notNull(),
	origin: text('origin').notNull(),
	// deposit | credit_memo | refund | manual
	originRefInvoiceId: uuid('origin_ref_invoice_id').references(() => invoices.id, {
		onDelete: 'set null'
	}),
	// Populated when origin=credit_memo and the source invoice is in Ebisu.
	notes: text('notes'),
	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	createdByUserId: uuid('created_by_user_id').references(() => users.id)
});

// ---------------------------------------------------------------------------
// QBO connections — OAuth state per environment
// ---------------------------------------------------------------------------
// One active row per environment (sandbox / production). Tokens are stored
// AES-256-GCM encrypted using QBO_TOKEN_ENC_KEY. On disconnect we keep the
// row for audit purposes with disconnected_at set; active = disconnected_at
// IS NULL. The default income / cogs account references are set during
// initial connection so subsequent Item creates have the required field.

export const qboConnections = pgTable('qbo_connections', {
	id: uuid('id').defaultRandom().primaryKey(),
	environment: text('environment').notNull(),
	// sandbox | production
	realmId: text('realm_id').notNull(),
	// QBO company ID the tokens authorize against.

	accessTokenCiphertext: text('access_token_ciphertext').notNull(),
	refreshTokenCiphertext: text('refresh_token_ciphertext').notNull(),
	expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
	// access token expiry. Refresh tokens last 100 days and rotate on each
	// refresh — we re-store the new pair every time we refresh.

	defaultIncomeAccountId: text('default_income_account_id'),
	defaultIncomeAccountName: text('default_income_account_name'),
	defaultCogsAccountId: text('default_cogs_account_id'),
	defaultCogsAccountName: text('default_cogs_account_name'),
	// Required for QBO Item creation. PM picks once at connection time.

	connectedAt: timestamp('connected_at', { withTimezone: true }).notNull().defaultNow(),
	connectedByUserId: uuid('connected_by_user_id').references(() => users.id),
	disconnectedAt: timestamp('disconnected_at', { withTimezone: true }),

	createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
	updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow()
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
export type Rfq = typeof rfqs.$inferSelect;
export type NewRfq = typeof rfqs.$inferInsert;
export type RfqLine = typeof rfqLines.$inferSelect;
export type NewRfqLine = typeof rfqLines.$inferInsert;
export type SalesOrder = typeof salesOrders.$inferSelect;
export type NewSalesOrder = typeof salesOrders.$inferInsert;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type NewPurchaseOrder = typeof purchaseOrders.$inferInsert;
export type OrderLine = typeof orderLines.$inferSelect;
export type NewOrderLine = typeof orderLines.$inferInsert;
export type Shipment = typeof shipments.$inferSelect;
export type NewShipment = typeof shipments.$inferInsert;
export type ShipmentLine = typeof shipmentLines.$inferSelect;
export type NewShipmentLine = typeof shipmentLines.$inferInsert;
export type Invoice = typeof invoices.$inferSelect;
export type NewInvoice = typeof invoices.$inferInsert;
export type InvoiceLine = typeof invoiceLines.$inferSelect;
export type NewInvoiceLine = typeof invoiceLines.$inferInsert;
export type Bill = typeof bills.$inferSelect;
export type NewBill = typeof bills.$inferInsert;
export type BillLine = typeof billLines.$inferSelect;
export type NewBillLine = typeof billLines.$inferInsert;
export type ClientCredit = typeof clientCredits.$inferSelect;
export type NewClientCredit = typeof clientCredits.$inferInsert;
export type ChangeOrder = typeof changeOrders.$inferSelect;
export type NewChangeOrder = typeof changeOrders.$inferInsert;
export type ChangeOrderLine = typeof changeOrderLines.$inferSelect;
export type NewChangeOrderLine = typeof changeOrderLines.$inferInsert;
export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
export type BudgetLine = typeof budgetLines.$inferSelect;
export type NewBudgetLine = typeof budgetLines.$inferInsert;
export type QboConnection = typeof qboConnections.$inferSelect;
export type NewQboConnection = typeof qboConnections.$inferInsert;
export type ShipQapHiddenLine = typeof shipQapHiddenLines.$inferSelect;
export type NewShipQapHiddenLine = typeof shipQapHiddenLines.$inferInsert;
export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type QapLine = typeof qapLines.$inferSelect;
export type NewQapLine = typeof qapLines.$inferInsert;
export type ImportSession = typeof importSessions.$inferSelect;

// Suppress unused-import warning for sql helper (referenced from migrations).
void sql;
