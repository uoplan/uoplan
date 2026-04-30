import { describe, it, expect } from 'vitest';
import { parseTermDropdown } from './check_terms.ts';

describe('parseTermDropdown', () => {
  it('extracts term IDs and names from a select element', () => {
    const html = `
      <select id="CLASS_SRCH_WRK2_STRM$35$">
        <option value="">Select a term</option>
        <option value="2261">2026 Winter Term</option>
        <option value="2265">2026 Spring/Summer Term</option>
      </select>
    `;
    expect(parseTermDropdown(html)).toEqual([
      { termId: '2261', name: '2026 Winter Term' },
      { termId: '2265', name: '2026 Spring/Summer Term' },
    ]);
  });

  it('skips blank option values', () => {
    const html = `
      <select id="CLASS_SRCH_WRK2_STRM$35$">
        <option value=""> </option>
        <option value="2261">2026 Winter Term</option>
      </select>
    `;
    expect(parseTermDropdown(html)).toEqual([{ termId: '2261', name: '2026 Winter Term' }]);
  });

  it('deduplicates by termId', () => {
    const html = `
      <select id="CLASS_SRCH_WRK2_STRM$35$">
        <option value="2261">2026 Winter Term</option>
        <option value="2261">2026 Winter Term (duplicate)</option>
      </select>
    `;
    expect(parseTermDropdown(html)).toHaveLength(1);
  });

  it('returns empty array when select element is missing', () => {
    expect(parseTermDropdown('<html></html>')).toEqual([]);
  });
});
