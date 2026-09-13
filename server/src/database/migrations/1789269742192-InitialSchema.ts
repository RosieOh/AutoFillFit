import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1789269742192 implements MigrationInterface {
    name = 'InitialSchema1789269742192'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "resumes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "title" character varying(120) NOT NULL DEFAULT '기본 이력서', "is_primary" boolean NOT NULL DEFAULT true, "headline" character varying(255), "education" jsonb NOT NULL DEFAULT '[]'::jsonb, "careers" jsonb NOT NULL DEFAULT '[]'::jsonb, "certificates" jsonb NOT NULL DEFAULT '[]'::jsonb, "essays" jsonb NOT NULL DEFAULT '[]'::jsonb, "skills" jsonb, "extra" jsonb, "user_id" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_9c8677802096d6baece48429d2e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_resumes_user_updated" ON "resumes" ("user_id", "updatedAt") `);
        await queryRunner.query(`CREATE TABLE "profiles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(60), "phone" character varying(30), "birthdate" date, "address" character varying(255), "zip_code" character varying(20), "user_id" uuid NOT NULL, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "REL_9e432b7df0d182f8d292902d1a" UNIQUE ("user_id"), CONSTRAINT "PK_8e520eb4da7dc01d0e190447c8e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('USER', 'ADMIN')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(255) NOT NULL, "role" "public"."users_role_enum" NOT NULL DEFAULT 'USER', "is_active" boolean NOT NULL DEFAULT true, "password" character varying(255) NOT NULL, "terms_agreed_at" TIMESTAMP WITH TIME ZONE, "privacy_agreed_at" TIMESTAMP WITH TIME ZONE, "policy_version" character varying(32), "failed_login_attempts" integer NOT NULL DEFAULT '0', "locked_until" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "uq_users_email" ON "users" ("email") `);
        await queryRunner.query(`CREATE TYPE "public"."admin_audit_logs_action_enum" AS ENUM('REVEAL_PII', 'UPDATE_ROLE', 'UPDATE_STATUS', 'DELETE_USER')`);
        await queryRunner.query(`CREATE TABLE "admin_audit_logs" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "action" "public"."admin_audit_logs_action_enum" NOT NULL, "actor_id" uuid, "actor_email" character varying(255) NOT NULL, "target_user_id" uuid, "target_email" character varying(255), "detail" jsonb, "ip_address" character varying(64), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "PK_de7a8fc2fbb525484c71a86bb96" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "idx_audit_created" ON "admin_audit_logs" ("createdAt") `);
        await queryRunner.query(`ALTER TABLE "resumes" ADD CONSTRAINT "FK_dce6e1ce26d348e602f56fa6363" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "profiles" ADD CONSTRAINT "FK_9e432b7df0d182f8d292902d1a2" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "FK_472967f954204bfc00191c43e7c" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "admin_audit_logs" DROP CONSTRAINT "FK_472967f954204bfc00191c43e7c"`);
        await queryRunner.query(`ALTER TABLE "profiles" DROP CONSTRAINT "FK_9e432b7df0d182f8d292902d1a2"`);
        await queryRunner.query(`ALTER TABLE "resumes" DROP CONSTRAINT "FK_dce6e1ce26d348e602f56fa6363"`);
        await queryRunner.query(`DROP INDEX "public"."idx_audit_created"`);
        await queryRunner.query(`DROP TABLE "admin_audit_logs"`);
        await queryRunner.query(`DROP TYPE "public"."admin_audit_logs_action_enum"`);
        await queryRunner.query(`DROP INDEX "public"."uq_users_email"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`DROP TABLE "profiles"`);
        await queryRunner.query(`DROP INDEX "public"."idx_resumes_user_updated"`);
        await queryRunner.query(`DROP TABLE "resumes"`);
    }

}
