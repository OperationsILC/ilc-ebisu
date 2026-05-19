-- ShipQAP: forward-looking shipping/arrival expectations per QAP line, plus
-- a per-user hide list so each PM can curate their own ShipQAP view without
-- destroying any data. See plans / Sean's spec for the design rationale.

ALTER TABLE "qap_lines" ADD COLUMN "expected_ship_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "qap_lines" ADD COLUMN "expected_arrival_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "qap_lines" ADD COLUMN "expected_ship_notes" text;--> statement-breakpoint

CREATE TABLE "ship_qap_hidden_lines" (
	"user_id" uuid NOT NULL,
	"qap_line_id" uuid NOT NULL,
	"hidden_at" timestamp with time zone DEFAULT now() NOT NULL,
	PRIMARY KEY ("user_id", "qap_line_id")
);--> statement-breakpoint

ALTER TABLE "ship_qap_hidden_lines" ADD CONSTRAINT "ship_qap_hidden_lines_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ship_qap_hidden_lines" ADD CONSTRAINT "ship_qap_hidden_lines_qap_line_id_qap_lines_id_fk" FOREIGN KEY ("qap_line_id") REFERENCES "public"."qap_lines"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

-- Quick lookup index for "which lines has this PM hidden on this project"
CREATE INDEX "ship_qap_hidden_lines_user_idx" ON "ship_qap_hidden_lines" ("user_id");
