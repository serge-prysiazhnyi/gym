import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWorkoutDuration1785689499784 implements MigrationInterface {
  name = 'AddWorkoutDuration1785689499784';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workouts" ADD "duration_seconds" integer`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "workouts" DROP COLUMN "duration_seconds"`,
    );
  }
}
