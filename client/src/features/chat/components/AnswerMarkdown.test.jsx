import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnswerMarkdown } from './AnswerMarkdown.jsx';

const citation = {
  label: 'S1',
  documentId: 'd1',
  documentTitle: 'OS notes',
  pageStart: 3,
  pageEnd: 3,
};

describe('AnswerMarkdown', () => {
  it('makes citations clickable and never renders links or HTML written by the model', () => {
    const onCite = vi.fn();
    const { container } = render(
      <AnswerMarkdown
        text={
          'The TLB caches translations [S1]. [Log in here](https://evil.example) <img src=x onerror=alert(1)> [S9]'
        }
        citations={[citation]}
        onCite={onCite}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Source S1: OS notes, p\. 3/ }));
    expect(onCite).toHaveBeenCalledWith(citation);
    expect(container.querySelector('a')).toBeNull(); // the phishing link is plain text
    expect(container.querySelector('img')).toBeNull(); // raw HTML isn't rendered
    expect(screen.getAllByRole('button')).toHaveLength(1); // the invented [S9] isn't clickable
  });
});
