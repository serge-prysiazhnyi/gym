import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExerciseNameLowerIndex1785668064732 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE UNIQUE INDEX "exercises_name_lower_idx" ON "exercises" (LOWER("name"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "exercises_name_lower_idx"`);
  }
}
