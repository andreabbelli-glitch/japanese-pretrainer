import { fsrs, Rating, createEmptyCard } from 'ts-fsrs';

const f = fsrs({});
let card = createEmptyCard(new Date());

const result1 = f.next(card, new Date(), Rating.Good);
const result2 = f.next(result1.card, new Date(Date.now() + 10 * 60000), Rating.Good);

// Let's say we review it 1.4 days later
let reconstructed_wrong = {
  ...result2.card,
  elapsed_days: 1 // rounded
};
let reconstructed_correct = {
  ...result2.card,
  elapsed_days: 1.4 // not rounded?
};

const nextDate = new Date(Date.now() + 1.4 * 24 * 3600000 + 10 * 60000);

const result3_wrong = f.next(reconstructed_wrong, nextDate, Rating.Good);
console.log('Result 3 rounded (Good 1.4d later):', result3_wrong.card.scheduled_days, result3_wrong.card.stability);

const result3_correct = f.next(reconstructed_correct, nextDate, Rating.Good);
console.log('Result 3 exact (Good 1.4d later):', result3_correct.card.scheduled_days, result3_correct.card.stability);

// Let's say we review it 1.6 days later
let reconstructed_wrong2 = {
  ...result2.card,
  elapsed_days: 2 // rounded up
};
let reconstructed_correct2 = {
  ...result2.card,
  elapsed_days: 1.6 // not rounded
};

const nextDate2 = new Date(Date.now() + 1.6 * 24 * 3600000 + 10 * 60000);

const result4_wrong = f.next(reconstructed_wrong2, nextDate2, Rating.Good);
console.log('Result 4 rounded (Good 1.6d later):', result4_wrong.card.scheduled_days, result4_wrong.card.stability);

const result4_correct = f.next(reconstructed_correct2, nextDate2, Rating.Good);
console.log('Result 4 exact (Good 1.6d later):', result4_correct.card.scheduled_days, result4_correct.card.stability);
