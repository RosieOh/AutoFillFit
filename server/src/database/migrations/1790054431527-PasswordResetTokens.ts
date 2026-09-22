import { MigrationInterface, QueryRunner } from "typeorm";

export class PasswordResetTokens1790054431527 implements MigrationInterface {
    name = 'PasswordResetTokens1790054431527'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "password_reset_tokens" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "token_hash" character varying(64) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_d16bebd73e844c48bca50ff8d3d" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_password_reset_user" ON "password_reset_tokens" ("user_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_password_reset_hash" ON "password_reset_tokens" ("token_hash") `);
        await queryRunner.query(`ALTER TABLE "resumes" ALTER COLUMN "education" SET DEFAULT '[]'::jsonb`);
        await queryRunner.query(`ALTER TABLE "resumes" ALTER COLUMN "careers" SET DEFAULT '[]'::jsonb`);
        await queryRunner.query(`ALTER TABLE "resumes" ALTER COLUMN "certificates" SET DEFAULT '[]'::jsonb`);
        await queryRunner.query(`ALTER TABLE "resumes" ALTER COLUMN "essays" SET DEFAULT '[]'::jsonb`);
        await queryRunner.query(`ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "FK_52ac39dd8a28730c63aeb428c9c" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "FK_52ac39dd8a28730c63aeb428c9c"`);
        await queryRunner.query(`ALTER TABLE "resumes" ALTER COLUMN "essays" SET DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "resumes" ALTER COLUMN "certificates" SET DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "resumes" ALTER COLUMN "careers" SET DEFAULT '[]'`);
        await queryRunner.query(`ALTER TABLE "resumes" ALTER COLUMN "education" SET DEFAULT '[]'`);
        await queryRunner.query(`DROP INDEX "public"."uq_password_reset_hash"`);
        await queryRunner.query(`DROP INDEX "public"."idx_password_reset_user"`);
        await queryRunner.query(`DROP TABLE "password_reset_tokens"`);
    }

}
