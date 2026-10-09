import { readFileSync } from 'node:fs'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import * as contracts from '../../packages/contracts/src'
import { healthFixture } from '../mocks/fixtures'

describe('shared schemas', () => {
  it('exports schemas for every section 4–5 enum and DTO with the documented fields', () => {
    const markdown = readFileSync('INTEGRATION_CONTRACT.md', 'utf8')
    const sections = markdown.slice(markdown.indexOf('## 4. Enums'), markdown.indexOf('## 6. Endpoints'))
    const source = [...sections.matchAll(/```ts\r?\n([\s\S]*?)```/g)].map(match => match[1]).join('\n')
    const ast = ts.createSourceFile('contract.ts', source, ts.ScriptTarget.Latest, true)
    const exports: Record<string, unknown> = contracts
    const interfaces = ast.statements.filter(ts.isInterfaceDeclaration)
    function fields(declaration: ts.InterfaceDeclaration): string[] {
      const own = declaration.members.map(member => member.name?.getText(ast)).filter((name): name is string => Boolean(name))
      const inherited = declaration.heritageClauses?.flatMap(clause => clause.types.flatMap(type => {
        const base = interfaces.find(value => value.name.text === type.expression.getText(ast))
        return base ? fields(base) : []
      })) ?? []
      return [...inherited, ...own]
    }
    for (const statement of ast.statements) {
      if (!ts.isInterfaceDeclaration(statement) && !ts.isTypeAliasDeclaration(statement)) continue
      const name = statement.name.text
      expect(exports[`${name}Schema`], `${name} schema`).toBeDefined()
      if (ts.isInterfaceDeclaration(statement)) {
        const schema = exports[`${name}Schema`]
        if (schema && typeof schema === 'object' && 'shape' in schema) expect(Object.keys(schema.shape as object).sort(), `${name} fields`).toEqual(fields(statement).sort())
      }
    }
  })
  it('validates fixtures and requires nullable fields to be present', () => {
    expect(contracts.ApiResponseSchema(contracts.HealthStatusSchema).parse(healthFixture)).toEqual(healthFixture)
    expect(contracts.UserSummarySchema.safeParse({ id: 'invalid', displayName: 'Owner' }).success).toBe(false)
    expect(contracts.LightingSpecSchema.safeParse({ quality: null, direction: null, temperature: null }).success).toBe(false)
  })
  it('keeps exhaustive counts and strict canonical enum values', () => {
    expect(contracts.RecommendationSchema.safeParse('UNKNOWN').success).toBe(false)
    expect(contracts.ProjectSummarySchema.shape.assetCounts.safeParse({ total: 0, byStatus: {} }).success).toBe(false)
  })
})
