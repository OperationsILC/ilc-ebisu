-- Wishbringer: a persistent feedback journal where signed-in users (PMs,
-- designers, admins) can drop notes about what they'd like Ebisu to do
-- differently. Each wish captures the URL they were on when they wrote it,
-- has a status, and threads comments underneath. Sean exports to markdown
-- and hands the whole thing to Claude for triage.

CREATE TABLE "wishes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"url_at_submission" text,
	"body" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	-- open | in_progress | done | wont_do
	"resolved_at" timestamp with time zone,
	"resolved_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE TABLE "wish_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"wish_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"is_claude_note" boolean DEFAULT false NOT NULL,
	-- True when a dev pastes Claude's response back as a comment. Lets the
	-- UI render it distinctly and the export label it clearly.
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint

ALTER TABLE "wishes" ADD CONSTRAINT "wishes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishes" ADD CONSTRAINT "wishes_resolved_by_user_id_users_id_fk" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wish_comments" ADD CONSTRAINT "wish_comments_wish_id_wishes_id_fk" FOREIGN KEY ("wish_id") REFERENCES "public"."wishes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wish_comments" ADD CONSTRAINT "wish_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint

CREATE INDEX "wishes_user_idx" ON "wishes" ("user_id");--> statement-breakpoint
CREATE INDEX "wishes_status_idx" ON "wishes" ("status");--> statement-breakpoint
CREATE INDEX "wish_comments_wish_idx" ON "wish_comments" ("wish_id");
