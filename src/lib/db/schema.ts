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
export type Company = typeof companies.$inferSelect;
export type NewCompany = typeof companies.$inferInsert;
export type QapLine = typeof qapLines.$inferSelect;
export type NewQapLine = typeof qapLines.$inferInsert;
export type ImportSession = typeof importSessions.$inferSelect;

// Suppress unused-import warning for sql helper (referenced from migrations).
void sql;
