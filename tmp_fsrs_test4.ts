import { fsrs, Rating, createEmptyCard } from 'ts-fsrs';

const f = fsrs({});
let card = createEmptyCard(new Date('2026-03-20T10:00:00.000Z'));

// 1st review: New -> Learning
const result1 = f.next(card, new Date('2026-03-20T10:00:00.000Z'), Rating.Good);
console.log('Result 1 (Good): state', result1.card.state, 'due', result1.card.due.toISOString(), 'stability', result1.card.stability);

// 2nd review: 10 minutes later
const result2 = f.next(result1.card, new Date('2026-03-20T10:10:00.000Z'), Rating.Good);
console.log('Result 2 (Good): state', result2.card.state, 'due', result2.card.due.toISOString(), 'stability', result2.card.stability);

// 3rd review: 1 day later
const result3 = f.next(result2.card, new Date('2026-03-21T10:10:00.000Z'), Rating.Good);
console.log('Result 3 (Good): state', result3.card.state, 'due', result3.card.due.toISOString(), 'stability', result3.card.stability);
