import {
  BaseEntity,
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from "typeorm"
import { SpecExtension } from "@common/enums"
import { MinimizedSpecContext } from "@common/types"

@Entity()
export class OpenApiSpec extends BaseEntity {
  @PrimaryColumn()
  name: string

  @Column()
  spec: string

  @Column("varchar", { array: true, default: [] })
  hosts: string[]

  @CreateDateColumn({ type: "timestamptz" })
  createdAt: Date

  @UpdateDateColumn({ type: "timestamptz" })
  updatedAt: Date

  @Column({ type: "timestamptz", nullable: true })
  specUpdatedAt: Date

  @Column({
    type: "enum",
    enum: SpecExtension,
    default: SpecExtension.JSON,
    enumName: "spec_extension_enum",
  })
  extension: SpecExtension

  @Column({ type: "bool", default: false })
  isAutoGenerated: boolean

  @Column({ type: "jsonb", default: {} })
  minimizedSpecContext: Record<string, MinimizedSpecContext>
}
