const DOCTOR_REVIEWS = [
  { id: 'kavya', stars: 5, quote: 'Asked about my dad’s sugar history before changing the dose. Didn’t rush. Texted the next morning to check the reading.', name: 'Kavya N.' },
  { id: 'imran', stars: 4, quote: 'Call started about 10 min late. Still, she actually listened. Prescription was easy to follow.', name: 'Imran' },
  { id: 'suresh', stars: 5, quote: 'Second visit. BP numbers finally make sense. Told me what to ignore on Google.', name: 'Suresh' },
  { id: 'neha', stars: 4, quote: 'Video froze twice on my phone. We switched to audio and it was fine. Advice was solid.', name: 'Neha Kulkarni' },
  { id: 'arjun', stars: 5, quote: 'Straight answers. No long lecture. I knew what to do this week before the call ended.', name: 'Arjun' },
  { id: 'fatima', stars: 4, quote: 'Good consult. Slot felt a bit short — I had one more question at the end.', name: 'Fatima' },
  { id: 'rohan', stars: 5, quote: 'My mother is 68 and hates video calls. She was fine with him. That almost never happens.', name: 'Rohan Mehta' },
  { id: 'divya', stars: 4, quote: 'Helpful. Don’t expect small talk. Goes straight to the report.', name: 'Divya' },
  { id: 'anjali', stars: 5, quote: 'Caught that my thyroid dose was off from the last lab. The clinic near home had missed it.', name: 'Anjali P.' },
];

const NUTRITION_REVIEWS = [
  { id: 'pooja', stars: 5, quote: 'Didn’t hand me a crash diet. We went through what I actually eat on night shifts.', name: 'Pooja' },
  { id: 'vikram', stars: 4, quote: 'Plan is doable. Grocery list was long for one person, I cut a few things myself.', name: 'Vikram' },
  { id: 'lakshmi', stars: 5, quote: 'First person who didn’t scold me for rice. The portion thing has actually stuck.', name: 'Lakshmi' },
  { id: 'aditya', stars: 4, quote: 'Useful. I wanted more on eating out. We only got to it at the end.', name: 'Aditya' },
  { id: 'meera', stars: 5, quote: 'Weight hasn’t dropped like magic, but the 11pm biscuits have. She checks in.', name: 'Meera S.' },
  { id: 'harish', stars: 4, quote: 'Session was good. The meal PDF landed a day late. Otherwise no complaints.', name: 'Harish' },
  { id: 'shalini', stars: 5, quote: 'Kid’s tiffin is less chaotic now. Practical stuff, not those pretty recipe posts.', name: 'Shalini' },
  { id: 'aisha', stars: 5, quote: 'Asked about my periods and sleep before calories. That part mattered more than the chart.', name: 'Aisha' },
  { id: 'nikhil', stars: 4, quote: 'Clear and patient. Still figuring out the breakfast swap. The rest is easy enough.', name: 'Nikhil' },
];

const AYURVEDA_REVIEWS = [
  { id: 'rekha', stars: 5, quote: 'Didn’t dump ten churnas on me. Started with sleep and one oil. I can keep up with that.', name: 'Rekha' },
  { id: 'joseph', stars: 4, quote: 'Calm session. A couple of the names went over my head. She repeated them when I asked.', name: 'Joseph' },
  { id: 'tanvi', stars: 5, quote: 'Digestion has been a mess for years. Two weeks in, bloating is less. Early, but I feel it.', name: 'Tanvi' },
  { id: 'manoj', stars: 4, quote: 'Liked the consult. The morning routine is a lot if you leave for work at 7.', name: 'Manoj' },
  { id: 'farhan', stars: 5, quote: 'Looked at my reports and still talked like a person. Not a textbook.', name: 'Farhan' },
  { id: 'ishita', stars: 5, quote: 'Stress advice was simple. No detox tea nonsense.', name: 'Ishita' },
  { id: 'geeta', stars: 4, quote: 'Had to ask twice about mixing this with my allopathy tablets. Then she explained it properly.', name: 'Geeta' },
  { id: 'kabir', stars: 5, quote: 'Booked for my father. He said she didn’t talk down to him. We’re booking next month.', name: 'Kabir' },
  { id: 'leela', stars: 4, quote: 'Honest about what would take time. I appreciated that more than a quick fix.', name: 'Leela' },
];

const POOLS = {
  doctor: DOCTOR_REVIEWS,
  nutritionist: NUTRITION_REVIEWS,
  ayurveda: AYURVEDA_REVIEWS,
};

const hashText = (value) => {
  const text = String(value || '');
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) % 100000;
  }
  return hash;
};

export const reviewsForExpert = (expert) => {
  const pool = POOLS[expert?.kind] || DOCTOR_REVIEWS;
  const seed = Number(expert?.expertId);
  const index = Number.isFinite(seed) && seed > 0 ? seed : hashText(expert?.name || expert?.kind || 'expert');
  const count = 2 + (index % 2);
  const start = index % pool.length;
  const step = 3 + (index % 3);
  const picked = [];
  const used = new Set();
  let cursor = start;

  while (picked.length < count && used.size < pool.length) {
    const slot = cursor % pool.length;
    if (!used.has(slot)) {
      used.add(slot);
      picked.push(pool[slot]);
    }
    cursor += step;
  }

  return picked;
};
