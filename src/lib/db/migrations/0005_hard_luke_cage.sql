CREATE TABLE "shipment_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"order_line_id" uuid NOT NULL,
	"qty_shipped" numeric NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipment_lines_shipment_order_line_uq" UNIQUE("shipment_id","order_line_id")
);
--> statement-breakpoint
CREATE TABLE "shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"shipment_no" text NOT NULL,
	"status" text DEFAULT 'expected' NOT NULL,
	"carrier" text,
	"tracking_number" text,
	"expected_date" timestamp with time zone,
	"shipped_date" timestamp with time zone,
	"received_date" timestamp with time zone,
	"received_at_location" text,
	"notes" text,
	"internal_notes" text,
	"row_version" bigint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by_user_id" uuid,
	"received_by_user_id" uuid,
	CONSTRAINT "shipments_shipment_no_unique" UNIQUE("shipment_no")
);
--> statement-breakpoint
ALTER TABLE "shipment_lines" ADD CONSTRAINT "shipment_lines_shipment_id_shipments_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "public"."shipments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipment_lines" ADD CONSTRAINT "shipment_lines_order_line_id_order_lines_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "public"."order_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_created_by_user_id_users_id_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_received_by_user_id_users_id_fk" FOREIGN KEY ("received_by_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shipment_lines_shipment_idx" ON "shipment_lines" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "shipment_lines_order_line_idx" ON "shipment_lines" USING btree ("order_line_id");