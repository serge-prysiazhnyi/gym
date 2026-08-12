import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkoutIdempotencyKey1786527555433 implements MigrationInterface {
  name = 'AddWorkoutIdempotencyKey1786527555433';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workouts" ADD "idempotency_key" character varying(128)`,
    );
    await queryRunner.query(
      `ALTER TABLE "workouts" ADD CONSTRAINT "UQ_143bf4d0d9f9686a7444a328dcf" UNIQUE ("idempotency_key")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workouts" DROP CONSTRAINT "UQ_143bf4d0d9f9686a7444a328dcf"`,
    );
    await queryRunner.query(
      `ALTER TABLE "workouts" DROP COLUMN "idempotency_key"`,
    );
  }
}
