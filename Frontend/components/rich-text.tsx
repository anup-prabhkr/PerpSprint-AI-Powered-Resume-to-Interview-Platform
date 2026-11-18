import { Fragment } from 'react';

/** Renders **bold** spans from model output without using innerHTML. */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="font-semibold text-foreground">{part}</strong>
        ) : (
          <Fragment key={i}>{part}</Fragment>
        ),
      )}
    </>
  );
}
