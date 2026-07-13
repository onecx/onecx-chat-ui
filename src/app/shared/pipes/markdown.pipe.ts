import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';
import { SecurityContext } from '@angular/core';
import { marked } from 'marked';

@Pipe({
  name: 'markdown',
  standalone: true,
})
export class MarkdownPipe implements PipeTransform {
  constructor(private readonly sanitizer: DomSanitizer) {}

  transform(value: string | undefined | null): string {
    if (!value) return '';

    const rawHtml = marked.parse(value, { async: false }) as string;

    return this.sanitizer.sanitize(SecurityContext.HTML, rawHtml) ?? '';
  }
}
