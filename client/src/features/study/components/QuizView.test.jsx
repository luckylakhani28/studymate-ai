import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuizView } from './StudyViews.jsx';

const content = {
  questions: [
    {
      question: 'What does the TLB cache?',
      options: ['Translations', 'Files', 'Threads', 'Sockets'],
      answerIndex: 0,
      explanation: 'It caches page table entries.',
      pages: [3],
    },
    {
      question: 'How many deadlock conditions are there?',
      options: ['Two', 'Three', 'Four', 'Five'],
      answerIndex: 2,
      explanation: 'The four Coffman conditions.',
      pages: [7],
    },
  ],
};

describe('QuizView', () => {
  it('scores answers and explains each question', () => {
    render(<QuizView content={content} documentId="d1" />);
    fireEvent.click(screen.getByLabelText('Translations'));
    fireEvent.click(screen.getByLabelText('Two'));
    fireEvent.click(screen.getByRole('button', { name: 'Check answers' }));

    expect(screen.getByRole('status').textContent).toBe('You scored 1 out of 2.');
    expect(screen.getByText(/four Coffman conditions/)).toBeTruthy();
  });
});
