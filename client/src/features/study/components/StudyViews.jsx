import { useState } from 'react';
import { formatPages } from '../../../lib/format.js';
import { openDocumentAtPage } from '../../documents/openDocument.js';
import { Button } from '../../../components/ui/Button.jsx';

function PageRefs({ documentId, pages }) {
  if (!pages?.length) return null;
  return (
    <button
      type="button"
      onClick={() => openDocumentAtPage(documentId, pages[0])}
      className="text-sm text-ink-soft underline underline-offset-4 hover:text-ink"
      aria-label={`Open the PDF at ${formatPages(pages)}`}
    >
      {formatPages(pages)}
    </button>
  );
}

export function SummaryView({ content, documentId }) {
  return (
    <div>
      <p className="font-reading text-xl leading-8">{content.tldr}</p>
      <div className="mt-6 max-w-prose space-y-4 leading-7">
        {content.overview.split(/\n{2,}/).map((paragraph, i) => (
          <p key={i}>{paragraph}</p>
        ))}
      </div>
      <h3 className="mt-10 font-semibold">Key points</h3>
      <ul className="mt-3 max-w-prose list-disc space-y-2 pl-5">
        {content.keyPoints.map((k, i) => (
          <li key={i}>
            {k.point} <PageRefs documentId={documentId} pages={k.pages} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NotesView({ content, documentId }) {
  return (
    <div className="max-w-prose space-y-8">
      {content.sections.map((section, i) => (
        <section key={i}>
          <h3 className="font-reading text-lg font-semibold">{section.heading}</h3>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 leading-7">
            {section.points.map((point, j) => (
              <li key={j}>
                {point.text} <PageRefs documentId={documentId} pages={point.pages} />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export function ConceptsView({ content, documentId }) {
  return (
    <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-[minmax(8rem,14rem)_1fr]">
      {content.concepts.map((c, i) => (
        <div key={i} className="contents">
          <dt className="font-semibold">{c.term}</dt>
          <dd className="leading-7">
            {c.definition} <PageRefs documentId={documentId} pages={c.pages} />
          </dd>
        </div>
      ))}
    </dl>
  );
}

const OPTION_STYLE = {
  idle: 'border-rule bg-white',
  correct: 'border-emerald-600 bg-emerald-50',
  wrong: 'border-danger bg-danger/5',
};

export function QuizView({ content, documentId }) {
  const [answers, setAnswers] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const { questions } = content;
  const score = questions.filter((q, i) => answers[i] === q.answerIndex).length;

  return (
    <div className="max-w-prose">
      <ol className="space-y-10">
        {questions.map((q, i) => (
          <li key={i}>
            <fieldset>
              <legend className="font-semibold leading-7">
                {i + 1}. {q.question}
              </legend>
              <div className="mt-3 space-y-2">
                {q.options.map((option, j) => {
                  const state = !submitted
                    ? 'idle'
                    : j === q.answerIndex
                      ? 'correct'
                      : answers[i] === j
                        ? 'wrong'
                        : 'idle';
                  return (
                    <label
                      key={j}
                      className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2 ${OPTION_STYLE[state]}`}
                    >
                      <input
                        type="radio"
                        name={`question-${i}`}
                        className="mt-1.5"
                        checked={answers[i] === j}
                        disabled={submitted}
                        onChange={() => setAnswers((a) => ({ ...a, [i]: j }))}
                      />
                      <span className="flex-1">{option}</span>
                      {state === 'correct' && (
                        <span className="text-sm font-semibold text-emerald-800">
                          Correct answer
                        </span>
                      )}
                      {state === 'wrong' && (
                        <span className="text-sm font-semibold text-danger">Your answer</span>
                      )}
                    </label>
                  );
                })}
              </div>
              {submitted && (
                <p className="mt-3 text-sm leading-6">
                  <span className="font-semibold">
                    {answers[i] === q.answerIndex ? 'Correct.' : 'Not quite.'}
                  </span>{' '}
                  {q.explanation} <PageRefs documentId={documentId} pages={q.pages} />
                </p>
              )}
            </fieldset>
          </li>
        ))}
      </ol>

      <div className="mt-10 flex flex-wrap items-center gap-4">
        {submitted ? (
          <>
            <p role="status" className="font-semibold">
              You scored {score} out of {questions.length}.
            </p>
            <Button
              variant="quiet"
              onClick={() => {
                setAnswers({});
                setSubmitted(false);
              }}
            >
              Try this quiz again
            </Button>
          </>
        ) : (
          <Button
            onClick={() => setSubmitted(true)}
            disabled={Object.keys(answers).length < questions.length}
          >
            Check answers
          </Button>
        )}
      </div>
    </div>
  );
}

export function FlashcardsView({ content, documentId }) {
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const { cards } = content;
  const card = cards[index];
  const go = (delta) => {
    setIndex((i) => (i + delta + cards.length) % cards.length);
    setFlipped(false);
  };

  return (
    <div className="mx-auto max-w-xl">
      <p className="text-sm text-ink-soft" aria-live="polite">
        Card {index + 1} of {cards.length}, {flipped ? 'answer' : 'question'}
      </p>
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="ruled-paper mt-3 flex min-h-64 w-full items-center rounded-sm pb-8 pl-20 pr-8 pt-8 text-left font-reading text-xl leading-8 ring-1 ring-rule"
      >
        {flipped ? card.back : card.front}
      </button>
      <div className="mt-2 flex items-center justify-between gap-4 text-sm text-ink-soft">
        <span>Click the card to {flipped ? 'see the question' : 'reveal the answer'}.</span>
        {flipped && <PageRefs documentId={documentId} pages={card.pages} />}
      </div>
      <div className="mt-6 flex justify-between">
        <Button variant="quiet" onClick={() => go(-1)}>
          Previous card
        </Button>
        <Button variant="quiet" onClick={() => go(1)}>
          Next card
        </Button>
      </div>
    </div>
  );
}
