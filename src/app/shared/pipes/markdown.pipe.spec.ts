import { TestBed } from '@angular/core/testing';
import { DomSanitizer } from '@angular/platform-browser';
import { MarkdownPipe } from './markdown.pipe';

describe('MarkdownPipe', () => {
  let pipe: MarkdownPipe;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    pipe = new MarkdownPipe(TestBed.inject(DomSanitizer));
  });

  it('returns an empty string for nullish values', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform('')).toBe('');
  });

  it('renders basic markdown as html', () => {
    const result = pipe.transform('**bold** and `code`');

    expect(result).toContain('<strong>bold</strong>');
    expect(result).toContain('<code>code</code>');
  });

  it('sanitizes unsafe html attributes', () => {
    const result = pipe.transform('<img src="x" onerror="alert(1)">');

    expect(result).toContain('<img src="x">');
    expect(result).not.toContain('onerror');
  });

  it('returns empty string when sanitizer returns null', () => {
    jest.spyOn(TestBed.inject(DomSanitizer), 'sanitize').mockReturnValue(null);
    const result = pipe.transform('**Hello**');
    expect(result).toBe('');
  });
});
