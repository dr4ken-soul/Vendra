/**
 * GENERATED FILE — do not edit by hand.
 *
 * Produced by analysis/build-film-data.mjs from analysis/recall-response.json,
 * which is a captured response from POST /api/assistant/recall against
 * https://vendra-psycho-projects.vercel.app.
 *
 * Every string here is real output from the deployed product. Nothing was written
 * for the film.
 */

export interface FilmSource {
  n: number;
  eventId: string;
  short: string;
  eventType: string;
  occurredAt: string;
  summary: string;
  dealDate: string | null;
  supplier: string;
  headline: string | null;
  quotedTotal: number | null;
  agreedTotal: number | null;
  receivedTotal: number | null;
  currency: string | null;
}

export interface FilmSegment {
  text: string;
  cites: number[];
}

export const FILM = {
  "capturedAt": "2026-10-09",
  "model": "gemini-3.8-flash",
  "grounded": true,
  "memoryStatus": "ready",
  "dealDate": "2026-09-30",
  "supplier": "Segun Wholesale",
  "headline": "Weekly provisions order",
  "answer": "According to SOURCE 6, you agreed on 6 cartons of tomato paste at 2,917 NGN per carton, totalling 17,500 NGN, following negotiation on 30 September 2026. SOURCE 1 notes the delivery was expected on 7 October 2026.\n\nAccording to SOURCE 4 and SOURCE 5, a short delivery occurred on 7 October 2026. Only four of the six cartons arrived, leaving two cartons missing. \n\nAccording to SOURCE 3, the supplier resolved the issue on 8 October 2026 by crediting 3,500 NGN for the two missing cartons.",
  "segments": [
    {
      "text": "According to SOURCE 6, you agreed on 6 cartons of tomato paste at 2,917 NGN per carton, totalling 17,500 NGN, following negotiation on 30 September 2026.",
      "cites": [
        6
      ]
    },
    {
      "text": "SOURCE 1 notes the delivery was expected on 7 October 2026.",
      "cites": [
        1
      ]
    },
    {
      "text": "According to SOURCE 4 and SOURCE 5, a short delivery occurred on 7 October 2026.",
      "cites": [
        4,
        5
      ]
    },
    {
      "text": "Only four of the six cartons arrived, leaving two cartons missing.",
      "cites": []
    },
    {
      "text": "According to SOURCE 3, the supplier resolved the issue on 8 October 2026 by crediting 3,500 NGN for the two missing cartons.",
      "cites": [
        3
      ]
    }
  ],
  "sources": [
    {
      "n": 1,
      "eventId": "28ec40b4-66b5-487a-b38b-af3ea592fae0",
      "short": "28ec40b4",
      "eventType": "terms_agreed",
      "occurredAt": "2026-10-09",
      "summary": "Terms agreed for Tomato paste, expected 07/10/2026.",
      "dealDate": "2026-09-30",
      "supplier": "Segun Wholesale",
      "headline": "Weekly provisions order",
      "quotedTotal": null,
      "agreedTotal": null,
      "receivedTotal": null,
      "currency": "NGN"
    },
    {
      "n": 2,
      "eventId": "c71d8da4-6c95-4ab2-b85c-69ba71b12f36",
      "short": "c71d8da4",
      "eventType": "quote_received",
      "occurredAt": "2026-10-09",
      "summary": "Weekly provisions order",
      "dealDate": "2026-09-30",
      "supplier": "Segun Wholesale",
      "headline": "Weekly provisions order",
      "quotedTotal": null,
      "agreedTotal": null,
      "receivedTotal": null,
      "currency": "NGN"
    },
    {
      "n": 3,
      "eventId": "09e7cbe5-52e5-46de-b956-98083f0770c6",
      "short": "09e7cbe5",
      "eventType": "resolution_recorded",
      "occurredAt": "2026-10-08",
      "summary": "Supplier credited 3,500 for the two missing cartons. Closed.",
      "dealDate": "2026-09-30",
      "supplier": "Segun Wholesale",
      "headline": "Weekly provisions order",
      "quotedTotal": null,
      "agreedTotal": null,
      "receivedTotal": null,
      "currency": "NGN"
    },
    {
      "n": 4,
      "eventId": "b0acf9b7-54cd-4d52-b75b-9a84bdffb5ea",
      "short": "b0acf9b7",
      "eventType": "issue_opened",
      "occurredAt": "2026-10-07",
      "summary": "Short delivery: two cartons missing from a six carton order.",
      "dealDate": "2026-09-30",
      "supplier": "Segun Wholesale",
      "headline": "Weekly provisions order",
      "quotedTotal": null,
      "agreedTotal": null,
      "receivedTotal": null,
      "currency": "NGN"
    },
    {
      "n": 5,
      "eventId": "5bb6e979-99f6-42da-b647-fb3837cf2f33",
      "short": "5bb6e979",
      "eventType": "delivery_checked",
      "occurredAt": "2026-10-07",
      "summary": "Four of six cartons arrived. Two missing.",
      "dealDate": "2026-09-30",
      "supplier": "Segun Wholesale",
      "headline": "Weekly provisions order",
      "quotedTotal": null,
      "agreedTotal": null,
      "receivedTotal": null,
      "currency": "NGN"
    },
    {
      "n": 6,
      "eventId": "caaae357-49d7-46c2-ab80-2e1ff2bea04f",
      "short": "caaae357",
      "eventType": "terms_agreed",
      "occurredAt": "2026-09-30",
      "summary": "Agreed 2,917 per carton after negotiation, 17,500 total.",
      "dealDate": "2026-09-30",
      "supplier": "Segun Wholesale",
      "headline": "Weekly provisions order",
      "quotedTotal": null,
      "agreedTotal": null,
      "receivedTotal": null,
      "currency": "NGN"
    },
    {
      "n": 7,
      "eventId": "3cce0cf3-36b8-4152-80b5-ef40adc3693d",
      "short": "3cce0cf3",
      "eventType": "quote_received",
      "occurredAt": "2026-09-30",
      "summary": "Quoted 6 cartons at 3,000 each, 18,000 total.",
      "dealDate": "2026-09-30",
      "supplier": "Segun Wholesale",
      "headline": "Weekly provisions order",
      "quotedTotal": null,
      "agreedTotal": null,
      "receivedTotal": null,
      "currency": "NGN"
    }
  ]
} as const;
