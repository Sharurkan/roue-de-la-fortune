import { describe, expect, it } from 'vitest';
import { messageFor, statusLabel } from './texts';

const teamName = (team: number) => ['Rouges', 'Bleus'][team] ?? '';

describe('messageFor', () => {
  it('says nothing when there is nothing to say', () => {
    expect(messageFor([], teamName)).toBeNull();
    expect(
      messageFor([{ type: 'wheelSpun', segmentIndex: 3, part: 'middle' }], teamName),
    ).toBeNull();
  });

  it('sums up a found consonant', () => {
    const message = messageFor(
      [{ type: 'letterFound', letter: 'S', count: 2, gain: 1000 }],
      teamName,
    );
    // The thousands separator is a narrow no-break space in French.
    expect(message?.text).toMatch(/^2 × S : \+1\s000 €$/u);
    expect(message?.isError).toBe(false);
  });

  it('joins the events of one action', () => {
    const events = [
      { type: 'letterAbsent', letter: 'Z' },
      { type: 'turnPassed', team: 1 },
    ] as const;
    expect(messageFor(events, teamName)?.text).toBe('Pas de Z · Bleus prend la main');
  });

  it('flags a rejected action as an error', () => {
    expect(
      messageFor([{ type: 'actionRejected', reason: 'letterAlreadyGuessed' }], teamName),
    ).toEqual({ text: 'Lettre déjà proposée', isError: true });
  });
});

describe('statusLabel', () => {
  it('explains a timeout', () => {
    expect(statusLabel({ kind: 'error', reason: 'timeout' })).toContain('même Wi-Fi');
  });

  it('keeps unknown errors short', () => {
    expect(statusLabel({ kind: 'error', reason: 'webrtc' })).toBe(
      'Erreur de connexion, nouvel essai…',
    );
  });
});
