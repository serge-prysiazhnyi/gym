import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1784987993334 implements MigrationInterface {
    name = 'InitialSchema1784987993334'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "muscle_groups" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(64) NOT NULL, CONSTRAINT "UQ_7b67dd7f791008ed1532e76a9c4" UNIQUE ("name"), CONSTRAINT "PK_87e03ee9f78be5d7a7d0e08897e" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "exercises" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying(128) NOT NULL, CONSTRAINT "UQ_a521b5cac5648eedc036e17d1bd" UNIQUE ("name"), CONSTRAINT "PK_c4c46f5fa89a58ba7c2d894e3c3" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "workout_sets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "workout_id" uuid NOT NULL, "exercise_id" uuid NOT NULL, "set_number" integer NOT NULL, "reps" integer NOT NULL, "weight_kg" numeric(6,2), CONSTRAINT "PK_5ad75c97e58e8c660a48926d438" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "workout_sets_exercise_idx" ON "workout_sets"  ("exercise_id") `);
        await queryRunner.query(`CREATE INDEX "workout_sets_workout_idx" ON "workout_sets"  ("workout_id") `);
        await queryRunner.query(`CREATE TABLE "workouts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "user_id" uuid NOT NULL, "performed_at" TIMESTAMP NOT NULL DEFAULT now(), "raw_text" text, "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_5b2319bf64a674d40237dbb1697" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "workouts_user_performed_idx" ON "workouts"  ("user_id", "performed_at") `);
        await queryRunner.query(`CREATE TYPE "public"."users_role_enum" AS ENUM('user', 'admin')`);
        await queryRunner.query(`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "email" character varying(320) NOT NULL, "password_hash" character varying NOT NULL, "name" character varying(255), "role" "public"."users_role_enum" NOT NULL DEFAULT 'user', "created_at" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "exercise_muscle_groups" ("exercisesId" uuid NOT NULL, "muscleGroupsId" uuid NOT NULL, CONSTRAINT "PK_841f339bc0b2f02adc1be9b0d47" PRIMARY KEY ("exercisesId", "muscleGroupsId"))`);
        await queryRunner.query(`CREATE INDEX "IDX_c48dd71d46e7b83229e76b3dd8" ON "exercise_muscle_groups"  ("exercisesId") `);
        await queryRunner.query(`CREATE INDEX "IDX_0ba88ec702ced6d52dd656654a" ON "exercise_muscle_groups"  ("muscleGroupsId") `);
        await queryRunner.query(`ALTER TABLE "workout_sets" ADD CONSTRAINT "FK_94da2c3001ef9f2125543f70ca6" FOREIGN KEY ("workout_id") REFERENCES "workouts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "workout_sets" ADD CONSTRAINT "FK_9a3b700413f3f5c26ee17daabd1" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "workouts" ADD CONSTRAINT "FK_2df679279a7ac263bcff20c78dd" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "exercise_muscle_groups" ADD CONSTRAINT "FK_c48dd71d46e7b83229e76b3dd86" FOREIGN KEY ("exercisesId") REFERENCES "exercises"("id") ON DELETE CASCADE ON UPDATE CASCADE`);
        await queryRunner.query(`ALTER TABLE "exercise_muscle_groups" ADD CONSTRAINT "FK_0ba88ec702ced6d52dd656654a4" FOREIGN KEY ("muscleGroupsId") REFERENCES "muscle_groups"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "exercise_muscle_groups" DROP CONSTRAINT "FK_0ba88ec702ced6d52dd656654a4"`);
        await queryRunner.query(`ALTER TABLE "exercise_muscle_groups" DROP CONSTRAINT "FK_c48dd71d46e7b83229e76b3dd86"`);
        await queryRunner.query(`ALTER TABLE "workouts" DROP CONSTRAINT "FK_2df679279a7ac263bcff20c78dd"`);
        await queryRunner.query(`ALTER TABLE "workout_sets" DROP CONSTRAINT "FK_9a3b700413f3f5c26ee17daabd1"`);
        await queryRunner.query(`ALTER TABLE "workout_sets" DROP CONSTRAINT "FK_94da2c3001ef9f2125543f70ca6"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_0ba88ec702ced6d52dd656654a"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_c48dd71d46e7b83229e76b3dd8"`);
        await queryRunner.query(`DROP TABLE "exercise_muscle_groups"`);
        await queryRunner.query(`DROP TABLE "users"`);
        await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);
        await queryRunner.query(`DROP INDEX "public"."workouts_user_performed_idx"`);
        await queryRunner.query(`DROP TABLE "workouts"`);
        await queryRunner.query(`DROP INDEX "public"."workout_sets_workout_idx"`);
        await queryRunner.query(`DROP INDEX "public"."workout_sets_exercise_idx"`);
        await queryRunner.query(`DROP TABLE "workout_sets"`);
        await queryRunner.query(`DROP TABLE "exercises"`);
        await queryRunner.query(`DROP TABLE "muscle_groups"`);
    }

}
