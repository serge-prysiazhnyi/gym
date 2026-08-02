import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddExerciseDescriptionAndImage1785667007650 implements MigrationInterface {
  name = 'AddExerciseDescriptionAndImage1785667007650';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "exercises" ADD "description" text`);
    await queryRunner.query(
      `ALTER TABLE "exercises" ADD "image_url" character varying(512)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "exercises" DROP COLUMN "image_url"`);
    await queryRunner.query(
      `ALTER TABLE "exercises" DROP COLUMN "description"`,
    );
  }
}
