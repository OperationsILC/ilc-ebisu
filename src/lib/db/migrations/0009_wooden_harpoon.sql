ALTER TABLE "budget_lines" DROP CONSTRAINT "budget_lines_qap_line_id_qap_lines_id_fk";
--> statement-breakpoint
ALTER TABLE "budget_lines" ALTER COLUMN "qap_line_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "budgets" ALTER COLUMN "budget_no" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "budget_lines" ADD COLUMN "qty_type_snapshot" text;--> statement-breakpoint
ALTER TABLE "budget_lines" ADD COLUMN "qty" numeric;--> statement-breakpoint
ALTER TABLE "budget_lines" ADD COLUMN "unit_dn" numeric;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "row_version" bigint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "budgets" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "target_budget_total" numeric;--> statement-breakpoint
ALTER TABLE "projects" ADD COLUMN "target_dollars_per_sf" numeric;--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_qap_line_id_qap_lines_id_fk" FOREIGN KEY ("qap_line_id") REFERENCES "public"."qap_lines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "budget_lines_budget_idx" ON "budget_lines" USING btree ("budget_id");--> statement-breakpoint
CREATE INDEX "budget_lines_qap_idx" ON "budget_lines" USING btree ("qap_line_id");--> statement-breakpoint
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_budget_no_unique" UNIQUE("budget_no");