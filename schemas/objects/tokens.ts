/**
 * Token storage objects.
 *
 * Tokens are stored FLAT — an array of `{path, type, value, aliasTarget}` —
 * rather than as the nested tree Figma exports. A tenant theme is 307 tokens
 * six levels deep; as nested objects that is unreviewable in the Studio and
 * produces unreadable diffs. Flat, each token is one array item with a real
 * path, searchable and diffable, and `path` round-trips back to the tree
 * exactly (see lib/tokens/flatten.ts).
 *
 * The raw export is kept alongside in `sourceJson` so the original Figma
 * payload is never lost, per "keep any tokens that aren't mapped".
 */
import { defineArrayMember, defineField, defineType } from 'sanity';

export const storedToken = defineType({
  name: 'storedToken',
  title: 'Token',
  type: 'object',
  fields: [
    defineField({
      name: 'path',
      title: 'Figma path',
      type: 'string',
      description: 'Dot-joined path exactly as exported, e.g. "🟢 color.text+icons.primary.default".',
      validation: (Rule) => Rule.required(),
      readOnly: true,
    }),
    defineField({
      name: 'type',
      title: 'Type',
      type: 'string',
      options: {
        list: [
          { title: 'Colour', value: 'color' },
          { title: 'Number', value: 'number' },
          { title: 'String', value: 'string' },
          { title: 'Boolean', value: 'boolean' },
        ],
      },
      validation: (Rule) => Rule.required(),
      readOnly: true,
    }),
    defineField({
      name: 'value',
      title: 'Value (JSON)',
      type: 'text',
      rows: 2,
      description:
        'JSON-encoded token value. Colours keep their full {hex, alpha, components} shape — the components are ' +
        'needed to emit rgba() for translucent tokens, so storing only the hex would silently drop alpha.',
      validation: (Rule) =>
        Rule.required().custom((value) => {
          if (!value) return 'A value is required.';
          try {
            JSON.parse(value);
            return true;
          } catch {
            return 'Must be valid JSON.';
          }
        }),
    }),
    defineField({
      name: 'aliasTarget',
      title: 'Alias target',
      type: 'string',
      description:
        'The Foundation variable this token points at, e.g. "brand/bookit/color/slate/900". Aliasing into a ' +
        'different brand is blocked at publish — it would emit a variable that silently resolves to this ' +
        "tenant's own primitive of the same name.",
    }),
    defineField({
      name: 'aliasCollection',
      title: 'Alias collection',
      type: 'string',
      readOnly: true,
      description: 'Figma collection the alias target lives in. Used to detect cross-collection drift.',
    }),
  ],
  preview: {
    select: { path: 'path', type: 'type', value: 'value', alias: 'aliasTarget' },
    prepare: ({ path, type, value, alias }) => ({
      title: path,
      subtitle: alias ? `→ ${alias}` : `${type}: ${String(value).slice(0, 48)}`,
    }),
  },
});

export const tokenSet = defineType({
  name: 'tokenSet',
  title: 'Token set',
  type: 'object',
  fields: [
    defineField({
      name: 'tokens',
      title: 'Tokens',
      type: 'array',
      of: [defineArrayMember({ type: 'storedToken' })],
    }),
    defineField({
      name: 'sourceJson',
      title: 'Original Figma export',
      type: 'text',
      rows: 3,
      description:
        'The unmodified export this set was imported from. Kept so nothing is lost if the token model changes, ' +
        'and so an import can be replayed. Not used at publish time.',
    }),
    defineField({
      name: 'importedAt',
      title: 'Imported at',
      type: 'datetime',
      readOnly: true,
    }),
    defineField({
      name: 'importedFilename',
      title: 'Imported from',
      type: 'string',
      readOnly: true,
    }),
  ],
});

/**
 * The result of the last publish attempt.
 *
 * Written by the publish action, read-only in the form. The PDP requires that
 * validation errors identify the token and the reason; this is where that
 * record lives so an editor can see why a publish was refused without
 * re-running anything.
 */
export const validationReport = defineType({
  name: 'validationReport',
  title: 'Validation report',
  type: 'object',
  readOnly: true,
  fields: [
    defineField({
      name: 'status',
      title: 'Status',
      type: 'string',
      options: {
        list: [
          { title: 'Never validated', value: 'never' },
          { title: 'Passing', value: 'passing' },
          { title: 'Blocked', value: 'failing' },
        ],
      },
    }),
    defineField({ name: 'checkedAt', title: 'Checked at', type: 'datetime' }),
    defineField({ name: 'errorCount', title: 'Errors', type: 'number' }),
    defineField({ name: 'warningCount', title: 'Warnings', type: 'number' }),
    defineField({
      name: 'noteCount',
      title: 'Notes',
      type: 'number',
      description: 'New tokens published but not yet referenced by any app.',
    }),
    defineField({
      name: 'issues',
      title: 'Issues',
      type: 'array',
      of: [
        defineArrayMember({
          type: 'object',
          name: 'validationIssue',
          fields: [
            defineField({ name: 'severity', type: 'string' }),
            defineField({ name: 'code', type: 'string' }),
            defineField({ name: 'subject', type: 'string' }),
            defineField({ name: 'message', type: 'text', rows: 2 }),
            defineField({ name: 'detail', type: 'text', rows: 3 }),
          ],
          preview: {
            select: { severity: 'severity', subject: 'subject', message: 'message' },
            prepare: ({ severity, subject, message }) => ({
              title: `${severity === 'error' ? '✕' : severity === 'warning' ? '!' : 'ℹ'} ${subject}`,
              subtitle: message,
            }),
          },
        }),
      ],
    }),
  ],
});

/**
 * The translated, app-ready output. This is what the API serves.
 *
 * Written only by the publish action after validation passes, so — per the
 * PDP — the published response always holds the last successfully validated
 * version, even while a draft contains broken tokens.
 */
export const compiledTheme = defineType({
  name: 'compiledTheme',
  title: 'Compiled output',
  type: 'object',
  readOnly: true,
  fields: [
    defineField({
      name: 'css',
      title: 'Generated CSS',
      type: 'text',
      rows: 10,
      description: 'Contents of src/theme/<tenant>/<tenant>.figma.css, including the compatibility alias block.',
    }),
    defineField({
      name: 'variablesJson',
      title: 'Variables (JSON)',
      type: 'text',
      rows: 6,
      description: 'Flat { "--var": "value" } map, for consumers that want JSON rather than a stylesheet.',
    }),
    defineField({ name: 'compiledAt', title: 'Compiled at', type: 'datetime' }),
    defineField({
      name: 'sourceHash',
      title: 'Source fingerprint',
      type: 'string',
      description: 'Hash of the tokens this output was built from. Lets the build skip unchanged tenants.',
    }),
    defineField({
      name: 'tokenCount',
      title: 'Tokens emitted',
      type: 'number',
    }),
    defineField({
      name: 'aliasCount',
      title: 'Compatibility aliases emitted',
      type: 'number',
      description: 'Old names kept alive for the frontend. Drops to zero when the migration completes.',
    }),
  ],
});


/**
 * A manually set token value.
 *
 * Written by the Style values editor, never by hand — every field is readOnly
 * so the raw JSON encoding cannot be corrupted from the form. Kept apart from
 * the imported token set so a Figma re-import cannot clobber it, and so
 * resetting restores the imported value exactly.
 */
export const tokenOverride = defineType({
  name: 'tokenOverride',
  title: 'Manually set value',
  type: 'object',
  readOnly: true,
  fields: [
    defineField({ name: 'path', title: 'Figma path', type: 'string' }),
    defineField({ name: 'type', title: 'Type', type: 'string' }),
    defineField({ name: 'value', title: 'Value (JSON)', type: 'text', rows: 2 }),
    defineField({ name: 'note', title: 'Note', type: 'string' }),
    defineField({ name: 'updatedAt', title: 'Changed at', type: 'datetime' }),
  ],
  preview: {
    select: { path: 'path', value: 'value' },
    prepare: ({ path, value }) => ({ title: path, subtitle: value }),
  },
});
